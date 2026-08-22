export const IOS_SUPPORT_PRODUCT_IDS = [
  'com.alekspetk.japan47.support.small',
  'com.alekspetk.japan47.support.medium',
  'com.alekspetk.japan47.support.large',
] as const;

export type IosSupportProductId = (typeof IOS_SUPPORT_PRODUCT_IDS)[number];
