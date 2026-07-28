from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("travel", "0015_placedeletionrequest")]

    operations = [
        migrations.AddField(
            model_name="placerevision",
            name="remove_image",
            field=models.BooleanField(
                default=False,
                help_text="Remove the published cover image when this revision is approved.",
            ),
        ),
        migrations.AddField(
            model_name="placerevision",
            name="removed_gallery_images",
            field=models.ManyToManyField(
                blank=True,
                help_text="Published gallery images to remove when this revision is approved.",
                related_name="pending_removal_revisions",
                to="travel.placeimage",
            ),
        ),
    ]
