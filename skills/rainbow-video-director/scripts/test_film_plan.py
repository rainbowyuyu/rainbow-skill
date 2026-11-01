"""Behavior checks for frame plans, not prompt style or visual quality."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from validate_director_package import validate


class FilmPlanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='director-film-plan-')
        self.root = Path(self.temp.name) / 'package'
        self.root.mkdir()
        (self.root / 'scenes').mkdir()
        (self.root / '00-film-brief.md').write_text('Make one complete film.', encoding='utf-8')
        for name in ('S01', 'S02'):
            (self.root / 'scenes' / f'{name}.md').write_text('A concrete scene production brief.', encoding='utf-8')
        self.plan = {
            'schema_version': 2, 'title': 'Short fractional-duration film',
            'duration_seconds': 2.5, 'fps': 60, 'frame_count': 150,
            'global_prompt_file': '00-film-brief.md',
            'segments': [
                {'id': 'S01', 'start_frame': 0, 'end_frame': 72, 'prompt_file': 'scenes/S01.md',
                 'entry_state': 'One closed object in a stable frame.', 'exit_state': 'The latch opens.',
                 'transition_out': {'type': 'match-cut', 'description': 'Follow the same opening edge.'}},
                {'id': 'S02', 'start_frame': 72, 'end_frame': 150, 'prompt_file': 'scenes/S02.md',
                 'entry_state': 'The opening edge retains its screen location.', 'exit_state': 'Hold the exposed mechanism.',
                 'transition_out': {'type': 'end', 'description': 'Let the movement settle before ending.'}},
            ],
            'events': [{'id': 'opened', 'frame': 72, 'segment_id': 'S02'}],
        }
        self.write()

    def tearDown(self):
        self.temp.cleanup()

    def write(self):
        (self.root / 'film-plan.json').write_text(json.dumps(self.plan), encoding='utf-8')

    def check_failure(self, fragment):
        self.write()
        result = validate(self.root)
        self.assertFalse(result['passed'], result)
        self.assertTrue(any(fragment in err for err in result['errors']), result)

    def test_minimal_fractional_film_has_no_layer_or_score_requirements(self):
        result = validate(self.root)
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['format'], 'film-plan-v2')
        self.assertNotIn('production_ready', result)

    def test_rounded_frame_count_is_not_accepted(self):
        self.plan['duration_seconds'] = 2.501
        self.check_failure('frame_count differs')

    def test_gap_and_overlap_both_fail(self):
        for start in (71, 73):
            with self.subTest(start=start):
                self.plan['segments'][1]['start_frame'] = start
                self.check_failure('gap/overlap')

    def test_short_final_coverage_fails(self):
        self.plan['segments'][1]['end_frame'] = 149
        self.check_failure('complete frame interval')

    def test_duplicate_segment_id_fails(self):
        self.plan['segments'][1]['id'] = 'S01'
        self.check_failure('duplicate segment id')

    def test_duplicate_event_id_fails(self):
        self.plan['events'].append(copy.deepcopy(self.plan['events'][0]))
        self.check_failure('nonempty and unique')

    def test_boundary_event_belongs_to_next_segment(self):
        self.plan['events'][0]['segment_id'] = 'S01'
        self.check_failure('does not belong')

    def test_end_frame_event_is_outside_film(self):
        self.plan['events'][0]['frame'] = 150
        self.check_failure('[0, frame_count)')

    def test_unknown_event_owner_fails(self):
        self.plan['events'][0]['segment_id'] = 'S03'
        self.check_failure('unknown segment_id')

    def test_empty_prompt_is_not_an_executable_handoff(self):
        (self.root / 'scenes/S02.md').write_text(' \n ', encoding='utf-8')
        self.check_failure('prompt file is empty')

    def test_missing_prompt_fails(self):
        self.plan['segments'][1]['prompt_file'] = 'not-created.md'
        self.check_failure('cannot read prompt')

    def test_outside_package_prompt_rejected_even_if_existing(self):
        (self.root.parent / 'outside.md').write_text('Outside.', encoding='utf-8')
        self.plan['segments'][1]['prompt_file'] = '../outside.md'
        self.check_failure('stay inside')

    def test_blank_states_or_transition_fail(self):
        self.plan['segments'][0]['entry_state'] = ' '
        self.plan['segments'][1]['transition_out']['description'] = ''
        self.check_failure('state description')
        self.check_failure('transition_out')

    def test_early_end_fails(self):
        self.plan['segments'][0]['transition_out']['type'] = 'end'
        self.check_failure('only terminate the last')

    def test_boolean_frames_are_not_integers(self):
        self.plan['segments'][0]['start_frame'] = False
        self.check_failure('frame interval')

    def test_loop_is_explicitly_not_an_automatic_visual_pass(self):
        self.plan['loop'] = True
        self.write()
        result = validate(self.root)
        self.assertTrue(result['passed'], result)
        self.assertTrue(any('require manual/rendered checks' in x for x in result['warnings']))

    def test_wrong_schema_does_not_fall_back_to_legacy(self):
        self.plan['schema_version'] = 3
        self.check_failure('schema_version: 2')
        self.assertEqual(validate(self.root)['format'], 'film-plan-v2')

    def test_invalid_numeric_input_returns_errors(self):
        for field, value in (('fps', None), ('duration_seconds', '2.5'), ('frame_count', True)):
            with self.subTest(field=field):
                original = self.plan[field]
                self.plan[field] = value
                self.write()
                self.assertFalse(validate(self.root)['passed'])
                self.plan[field] = original


if __name__ == '__main__':
    unittest.main(verbosity=2)
