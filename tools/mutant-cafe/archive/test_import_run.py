import json
import unittest
from import_run import import_run


class ImportRunTests(unittest.TestCase):
    def setUp(self):
        self.commit = "a" * 40
        self.result = {"mutant": {"id": "1" * 24, "file": "/work/src/chart.ts",
                                 "functionName": "chart", "genre": "FnValue",
                                 "span": {"start": {"line": 3}}},
                       "outcome": "untested", "output": "runner details"}

    def report(self):
        return json.dumps({"schemaVersion": 2, "root": "/work", "results": [self.result]}).encode()

    def test_retries_and_later_observations(self):
        archive = import_run([], self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")
        self.assertEqual(archive, import_run(archive, self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z"))
        self.assertNotIn("runner details", str(archive))
        self.assertEqual(archive[0]["entries"][0]["file"], "src/chart.ts")
        self.result["outcome"] = "caught"
        with self.assertRaises(ValueError):
            import_run(archive, self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")
        updated = import_run(archive, self.report(), 42, 2, self.commit, "2026-11-25T18:30:39Z")
        self.assertEqual([r["entries"][0]["outcome"] for r in updated], ["untested", "caught"])

    def test_rejects_paths_outside_web_source(self):
        self.result["mutant"]["file"] = "/work/src/../../outside.ts"
        with self.assertRaises(ValueError):
            import_run([], self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")

    def test_workspace_is_part_of_run_identity_and_legacy_web_import_is_idempotent(self):
        args = (self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z")
        web = import_run([], *args)
        for key in ("workspace", "selected", "failed"):
            del web[0][key]
        self.assertEqual(import_run(web, *args), web)
        both = import_run(web, *args, "apps/zloz-demo")
        self.assertEqual(len(both), 2)
        self.assertEqual(both[1]["workspace"], "apps/zloz-demo")
        viz = import_run(both, *args, "packages/foldkit-viz")
        self.assertEqual(len(viz), 3)
        self.assertEqual(import_run(viz, *args, "packages/foldkit-viz"), viz)
        astro = import_run(viz, *args, "packages/astro-foldkit")
        self.assertEqual(len(astro), 4)
        self.assertEqual(import_run(astro, *args, "packages/astro-foldkit"), astro)
        renderer = import_run(astro, *args, "packages/astro-effect-ui")
        self.assertEqual(len(renderer), 5)
        self.assertEqual(renderer[-1]["workspace"], "packages/astro-effect-ui")
        self.assertEqual(import_run(renderer, *args, "packages/astro-effect-ui"), renderer)
        with self.assertRaises(ValueError):
            import_run([], *args, "../anywhere")

    def test_custom_dataset_replay_keeps_its_description(self):
        mutant = self.result["mutant"]
        mutant.update(genre="CustomStationOnly", description="Custom replay: key by station alone.")
        args = (self.report(), 42, 1, self.commit, "2026-11-25T18:30:39Z", "packages/dataset-explorer")
        archive = import_run([], *args)
        self.assertEqual(archive[0]["entries"][0]["description"], mutant["description"])
        self.assertEqual(import_run(archive, *args), archive)
