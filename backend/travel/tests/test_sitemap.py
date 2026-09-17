from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from travel.models import Place, Prefecture, Region, Review
from travel.sitemaps import absolute_loc, iter_sitemap_entries, render_sitemap_xml

User = get_user_model()


@override_settings(FRONTEND_URL="https://japan47.example")
class SitemapTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user("author", "author@example.com", "StrongPass123!")
        self.empty = User.objects.create_user("empty", "empty@example.com", "StrongPass123!")
        self.region = Region.objects.create(name=Region.RegionName.KANTO, display_order=1)
        self.prefecture = Prefecture.objects.create(
            region=self.region, name="Tokyo", display_order=1
        )
        self.place = Place.objects.create(
            author=self.author,
            prefecture=self.prefecture,
            name="Akihabara",
            slug="akihabara",
            description="Electric town.",
            status=Place.Status.PUBLISHED,
        )
        Place.objects.create(
            author=self.author,
            prefecture=self.prefecture,
            name="Hidden draft",
            slug="hidden-draft",
            description="Should not appear.",
            status=Place.Status.PENDING,
        )
        Review.objects.create(
            place=self.place,
            author=self.author,
            rating=5,
            comment="Great neon lights.",
        )

    def test_absolute_loc_uses_no_trailing_slash_policy(self):
        self.assertEqual(absolute_loc("/"), "https://japan47.example/")
        self.assertEqual(absolute_loc("/prefectures"), "https://japan47.example/prefectures")
        self.assertEqual(
            absolute_loc("/places/1/akihabara"),
            "https://japan47.example/places/1/akihabara",
        )

    def test_sitemap_includes_canonical_public_urls_only(self):
        locs = [entry["loc"] for entry in iter_sitemap_entries()]
        self.assertIn("https://japan47.example/", locs)
        self.assertIn("https://japan47.example/regions", locs)
        self.assertIn("https://japan47.example/prefectures", locs)
        self.assertIn("https://japan47.example/places", locs)
        self.assertIn("https://japan47.example/regions/kanto", locs)
        self.assertIn("https://japan47.example/prefectures/Tokyo", locs)
        self.assertIn(
            f"https://japan47.example/places/{self.place.id}/{self.place.slug}",
            locs,
        )
        self.assertIn(f"https://japan47.example/contributors/{self.author.id}", locs)
        self.assertNotIn(f"https://japan47.example/contributors/{self.empty.id}", locs)
        self.assertTrue(all("/hidden-draft" not in loc for loc in locs))
        self.assertTrue(all("?" not in loc for loc in locs))
        self.assertTrue(all(not loc.rstrip("/").endswith("//") for loc in locs))
        # No trailing-slash variants except the homepage root.
        self.assertTrue(
            all(loc == "https://japan47.example/" or not loc.endswith("/") for loc in locs)
        )

    def test_sitemap_xml_endpoint_returns_valid_xml(self):
        response = self.client.get(reverse("sitemap"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/xml", response["Content-Type"])
        body = response.content.decode()
        self.assertIn("<urlset", body)
        self.assertIn(
            f"<loc>https://japan47.example/places/{self.place.id}/{self.place.slug}</loc>",
            body,
        )
        self.assertIn(f"<loc>https://japan47.example/contributors/{self.author.id}</loc>", body)
        self.assertIn("<lastmod>", body)

    def test_render_sitemap_xml_escapes_entities(self):
        xml = render_sitemap_xml(
            [{"loc": "https://japan47.example/places/1/a&b", "lastmod": "2026-01-01T00:00:00Z"}]
        )
        self.assertIn("a&amp;b", xml)
        self.assertNotIn("a&b</loc>", xml)
