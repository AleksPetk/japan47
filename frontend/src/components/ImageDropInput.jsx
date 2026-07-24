import { useState } from 'react'

export default function ImageDropInput({ id, multiple = false, onFiles }) {
  const [dragging, setDragging] = useState(false)
  const acceptFiles = (files) => onFiles(multiple ? [...files] : files[0] || null)
  return <div
    className={`image-drop${dragging ? ' image-drop--active' : ''}`}
    onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files) }}
  >
    <input id={id} type="file" multiple={multiple} accept="image/*,.heic,.heif" onChange={(event) => acceptFiles(event.target.files)} />
    <span>Choose {multiple ? 'images' : 'an image'} or drop {multiple ? 'them' : 'it'} here</span>
  </div>
}
