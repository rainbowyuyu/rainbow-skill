"""Inspect Blender in an isolated --background --factory-startup process.

No render, user-preference save, scene load, or .blend save is performed.
Usage: blender --background --factory-startup --python this.py -- --output result.json
"""

import argparse
import csv
import datetime
import io
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys

import bpy


def command_result(argv):
    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            errors="replace",
            timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        return {"command": argv, "returncode": result.returncode,
                "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}
    except Exception as error:
        return {"command": argv, "error": str(error)}


def engine_ids():
    scene = bpy.context.scene
    original = scene.render.engine
    candidates = {"BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES", "BLENDER_WORKBENCH"}
    pending = list(bpy.types.RenderEngine.__subclasses__())
    while pending:
        cls = pending.pop()
        candidates.add(getattr(cls, "bl_idname", ""))
        pending.extend(cls.__subclasses__())
    available = []
    for engine in sorted(candidates - {""}):
        try:
            scene.render.engine = engine
            available.append(engine)
        except (TypeError, ValueError):
            pass
    scene.render.engine = original
    return {"factory_default": original, "available": available}


def cycles_devices():
    addon = bpy.context.preferences.addons.get("cycles")
    if addon is None:
        return {"available": False}
    prefs = addon.preferences
    result = {"available": True, "factory_compute_device_type": prefs.compute_device_type,
              "backends": {}}
    try:
        types = [item[0] for item in prefs.get_device_types(bpy.context)]
    except Exception as error:
        result["backend_enumeration_error"] = str(error)
        types = ["NONE", "CUDA", "OPTIX", "HIP", "ONEAPI", "METAL"]
    for backend in types:
        if backend == "NONE":
            continue
        try:
            devices = prefs.get_devices_for_type(backend)
            result["backends"][backend] = [
                {"name": device.name, "type": device.type, "id": device.id,
                 "enabled_in_probe_process": bool(device.use)} for device in devices
            ]
        except Exception as error:
            result["backends"][backend] = {"error": str(error)}
    # CPU is a supported Cycles rendering device even when a GPU backend has no devices.
    result["scene_device_options"] = ["CPU", "GPU"]
    result["cpu"] = platform.processor()
    return result


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    options = parser.parse_args(args)
    report = {
        "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "Isolated factory-startup background probe; no scene or user preferences saved; no render executed",
        "blender": {
            "binary": bpy.app.binary_path,
            "version": bpy.app.version_string,
            "version_tuple": list(bpy.app.version),
            "build_hash": bpy.app.build_hash.decode(),
            "background": bpy.app.background,
            "python": sys.version,
            "engines": engine_ids(),
            "cycles": cycles_devices(),
        },
        "host": {"system": platform.platform(), "processor": platform.processor()},
        "tools": {},
    }
    for name in ("ffmpeg", "ffprobe"):
        executable = shutil.which(name)
        report["tools"][name] = {"path": executable}
        if executable:
            result = command_result([executable, "-version"])
            if "stdout" in result:
                result["stdout"] = result["stdout"].splitlines()[0]
            report["tools"][name]["version_check"] = result
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        result = command_result([
            nvidia_smi,
            "--query-gpu=name,driver_version,memory.total,memory.free,utilization.gpu",
            "--format=csv,noheader,nounits",
        ])
        report["host"]["nvidia_smi"] = result
        if result.get("returncode") == 0:
            fields = ["name", "driver_version", "memory_total_mib", "memory_free_mib", "utilization_percent"]
            report["host"]["nvidia_gpus"] = [
                dict(zip(fields, [value.strip() for value in row]))
                for row in csv.reader(io.StringIO(result["stdout"]))
            ]
    output = Path(options.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BLENDER_RUNTIME_REPORT=" + str(output))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
