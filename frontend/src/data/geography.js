/**
 * Stable Japan geography used for build-time SEO prerender.
 * Mirrors backend Region.RegionName and Prefecture.PREFECTURE_REGION.
 */
export const REGIONS = [
  { name: 'hokkaido', label: 'Hokkaido' },
  { name: 'tohoku', label: 'Tohoku' },
  { name: 'kanto', label: 'Kanto' },
  { name: 'chubu', label: 'Chubu' },
  { name: 'kansai', label: 'Kansai' },
  { name: 'chugoku', label: 'Chugoku' },
  { name: 'shikoku', label: 'Shikoku' },
  { name: 'kyushu', label: 'Kyushu' },
  { name: 'okinawa', label: 'Okinawa' },
]

/** Prefecture display name → region label (same keys as Django PREFECTURE_REGION). */
export const PREFECTURE_REGION_LABEL = {
  Hokkaido: 'Hokkaido',
  Aomori: 'Tohoku',
  Iwate: 'Tohoku',
  Miyagi: 'Tohoku',
  Akita: 'Tohoku',
  Yamagata: 'Tohoku',
  Fukushima: 'Tohoku',
  Ibaraki: 'Kanto',
  Tochigi: 'Kanto',
  Gunma: 'Kanto',
  Saitama: 'Kanto',
  Chiba: 'Kanto',
  Tokyo: 'Kanto',
  Kanagawa: 'Kanto',
  Niigata: 'Chubu',
  Toyama: 'Chubu',
  Ishikawa: 'Chubu',
  Fukui: 'Chubu',
  Yamanashi: 'Chubu',
  Nagano: 'Chubu',
  Gifu: 'Chubu',
  Shizuoka: 'Chubu',
  Aichi: 'Chubu',
  Mie: 'Kansai',
  Shiga: 'Kansai',
  Kyoto: 'Kansai',
  Osaka: 'Kansai',
  Hyogo: 'Kansai',
  Nara: 'Kansai',
  Wakayama: 'Kansai',
  Tottori: 'Chugoku',
  Shimane: 'Chugoku',
  Okayama: 'Chugoku',
  Hiroshima: 'Chugoku',
  Yamaguchi: 'Chugoku',
  Tokushima: 'Shikoku',
  Kagawa: 'Shikoku',
  Ehime: 'Shikoku',
  Kochi: 'Shikoku',
  Fukuoka: 'Kyushu',
  Saga: 'Kyushu',
  Nagasaki: 'Kyushu',
  Kumamoto: 'Kyushu',
  Oita: 'Kyushu',
  Miyazaki: 'Kyushu',
  Kagoshima: 'Kyushu',
  Okinawa: 'Okinawa',
}

const regionByLabel = Object.fromEntries(REGIONS.map((region) => [region.label, region]))

export const PREFECTURES = Object.entries(PREFECTURE_REGION_LABEL).map(([name, regionLabel]) => {
  const region = regionByLabel[regionLabel]
  return {
    name,
    regionName: region.name,
    regionLabel: region.label,
  }
})
