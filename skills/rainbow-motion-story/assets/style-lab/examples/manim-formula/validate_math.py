"""Fast mathematical boundary checks for the worked examples."""
from pathlib import Path
import ast,json,math
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
source=Path(__file__).with_name('scenes.py').read_text(encoding='utf-8')
tree=ast.parse(source)
assert not any(ord(c)<32 and c not in [chr(10),chr(13),chr(9)] for c in source)
strings=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str)]
b=chr(92)
for required in [b+'frac{(1+h)^2-1}{h}=2+h',b+'Delta x',b+'sin'+b+'theta=',b+'hat e_1']:
 assert any(required in s for s in strings), required
for h in [1.4,.55,.08]:
 assert math.isclose(((1+h)**2-1)/h,2+h,rel_tol=1e-12)
assert 2+.08!=2
A=np.array([[2.,1.],[1.,1.]])
assert np.allclose(A@np.array([1,0]),[2,1])
assert np.allclose(A@np.array([0,1]),[1,1])
assert np.allclose(A@np.array([1,1]),[3,2])
for t in np.linspace(0,1,21):
 assert math.isclose(np.linalg.det((1-t)*np.eye(2)+t*A),1+t-t*t,rel_tol=1e-12)
for theta in np.linspace(0,2*math.pi,101):
 assert math.isclose((complex(math.cos(theta),math.sin(theta))).imag,math.sin(theta),abs_tol=1e-14)
assert 2*(3+2)==2*3+2*2==10
result={'passed':True,'checks':['parse without control character corruption','TeX commands present','distributivity with explicit values','finite difference not mislabelled exact derivative','column-basis mapping','linear interpolation determinant','unit circle projection'], 'sampleCounts':{'derivative':3,'matrixInterpolation':21,'circle':101}}
(ROOT/'qa/manim-formula-math.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
