import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://mm-tiktok.netlify.app',
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1,
    },
  ]
}
