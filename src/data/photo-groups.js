import photos from "./photos.json";

const groupsById = new Map();
for (const photo of photos) {
  if (!groupsById.has(photo.categoryId)) {
    groupsById.set(photo.categoryId, { id: photo.categoryId, label: photo.category, photos: [] });
  }
  groupsById.get(photo.categoryId).photos.push(photo);
}

export const photoGroups = [...groupsById.values()];
