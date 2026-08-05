import FormField from '../../components/FormField'
import ImageDropInput from '../../components/ImageDropInput'
import MediaImage from '../../components/MediaImage'

export default function PlaceImageFields({
  editing,
  placeName,
  errors,
  displayedMainImage,
  image,
  removeImage,
  pendingRevision,
  remainingGallerySlots,
  maxGalleryImages,
  existingGallery,
  pendingGallery,
  galleryFiles,
  removedGalleryIds,
  removedPendingImageIds,
  onChooseMainImage,
  onClearMainImage,
  onToggleRemoveMainImage,
  onChooseGalleryFiles,
  onClearGalleryFiles,
  onToggleGalleryRemoval,
  onTogglePendingRemoval,
}) {
  return (
    <>
      <FormField
        label="Main image"
        name="image"
        errors={errors}
        hint="JPEG, PNG, WebP, or HEIF; maximum 8 MB."
      >
        {editing && displayedMainImage && !image && (
          <div
            className={`existing-main-image${removeImage ? ' existing-main-image--removed' : ''}`}
          >
            <MediaImage src={displayedMainImage} alt={`${placeName} current main`} />
            <div>
              <strong>
                {removeImage
                  ? 'Main image will be removed after approval'
                  : pendingRevision?.image_url
                    ? 'Proposed main image'
                    : 'Current main image'}
              </strong>
              <button type="button" className="button" onClick={onToggleRemoveMainImage}>
                {removeImage ? 'Keep image' : 'Remove image'}
              </button>
            </div>
          </div>
        )}
        {image && (
          <div className="selected-files">
            <span>New main image: {image.name}</span>
            <button type="button" onClick={onClearMainImage}>
              Clear selection
            </button>
          </div>
        )}
        <ImageDropInput id="image" onFiles={onChooseMainImage} />
      </FormField>
      <FormField
        label="Gallery images"
        name="gallery_images"
        errors={errors}
        hint={`Up to ${maxGalleryImages} additional photos. ${remainingGallerySlots} slot${remainingGallerySlots === 1 ? '' : 's'} available.`}
      >
        {editing && existingGallery.length > 0 && (
          <div className="existing-gallery-editor">
            {existingGallery.map((galleryImage) => {
              const removed = removedGalleryIds.includes(galleryImage.id)
              return (
                <article className={removed ? 'is-removed' : ''} key={galleryImage.id}>
                  <MediaImage
                    src={galleryImage.thumbnail_url || galleryImage.image_url}
                    alt={galleryImage.caption || `${placeName} gallery photo`}
                  />
                  <button type="button" onClick={() => onToggleGalleryRemoval(galleryImage.id)}>
                    {removed ? 'Keep photo' : 'Remove photo'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
        {pendingGallery.length > 0 && (
          <>
            <small>Photos already included in this pending proposal</small>
            <div className="existing-gallery-editor">
              {pendingGallery.map((galleryImage) => {
                const removed = removedPendingImageIds.includes(galleryImage.id)
                return (
                  <article className={removed ? 'is-removed' : ''} key={galleryImage.id}>
                    <MediaImage
                      src={galleryImage.thumbnail_url || galleryImage.image_url}
                      alt={galleryImage.caption || `${placeName} proposed gallery photo`}
                    />
                    <button type="button" onClick={() => onTogglePendingRemoval(galleryImage.id)}>
                      {removed ? 'Keep photo' : 'Remove photo'}
                    </button>
                  </article>
                )
              })}
            </div>
          </>
        )}
        {galleryFiles.length > 0 && (
          <div className="selected-files">
            <span>
              {galleryFiles.length} new gallery photo{galleryFiles.length === 1 ? '' : 's'} selected
            </span>
            <button type="button" onClick={onClearGalleryFiles}>
              Clear selection
            </button>
          </div>
        )}
        {remainingGallerySlots > 0 && (
          <ImageDropInput id="gallery_images" multiple onFiles={onChooseGalleryFiles} />
        )}
      </FormField>
    </>
  )
}
