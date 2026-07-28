import type { ImagePickerAsset } from 'expo-image-picker';

export function appendImage(form: FormData, field: string, asset: ImagePickerAsset) {
  form.append(field, {
    uri: asset.uri,
    name: asset.fileName || `${field}-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  } as any);
}
