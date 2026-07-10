import unittest

from organization_links import normalize_organization_pair, resolve_allowed_organization_ids


class OrganizationLinkTests(unittest.TestCase):
    def test_pair_is_normalized_in_both_directions(self):
        self.assertEqual(normalize_organization_pair(20, 10), (10, 20))
        self.assertEqual(normalize_organization_pair("10", "20"), (10, 20))

    def test_self_link_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_organization_pair(10, 10)

    def test_links_are_bidirectional(self):
        links = [{"organization_a_id": 10, "organization_b_id": 20}]
        self.assertEqual(resolve_allowed_organization_ids(10, links), [10, 20])
        self.assertEqual(resolve_allowed_organization_ids(20, links), [10, 20])

    def test_unrelated_and_duplicate_links_are_ignored(self):
        links = [
            {"organization_a_id": 10, "organization_b_id": 20},
            {"organization_a_id": 10, "organization_b_id": 20},
            {"organization_a_id": 30, "organization_b_id": 40},
        ]
        self.assertEqual(resolve_allowed_organization_ids(10, links), [10, 20])


if __name__ == "__main__":
    unittest.main()
