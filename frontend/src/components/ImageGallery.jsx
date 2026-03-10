import { useState } from 'react'

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNTU1NTY1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'

export default function ImageGallery({ images }) {
  const [active, setActive] = useState(0)
  const imgs = images?.length ? images : [{ image_url: PLACEHOLDER, id: 0 }]

  return (
    <div className="gallery">
      <div className="gallery-main">
        <img
          src={imgs[active]?.image_url || PLACEHOLDER}
          alt="listing"
          onError={e => { e.target.src = PLACEHOLDER }}
        />
      </div>
      {imgs.length > 1 && (
        <div className="gallery-thumbs">
          {imgs.map((img, i) => (
            <div
              key={img.id || i}
              className={`gallery-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={img.image_url || PLACEHOLDER} alt="" onError={e => { e.target.src = PLACEHOLDER }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
