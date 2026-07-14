import { imgUrl } from '../utils';

export default function ResponsiveCover({ manga, alt = '', ...imgProps }) {
  const covers = manga?.coverUrls;
  const fallback = imgUrl(covers?.desktop || manga?.coverUrl);

  return (
    <picture className="contents">
      {covers?.mobile && <source media="(max-width: 639px)" srcSet={imgUrl(covers.mobile)} />}
      {covers?.tablet && <source media="(max-width: 1023px)" srcSet={imgUrl(covers.tablet)} />}
      <img {...imgProps} src={fallback} alt={alt} />
    </picture>
  );
}
