import React, { useState } from 'react';
import styled from 'styled-components';
import coverPlaceholder from '../assets/images/cover-placeholder.svg';
import { PaperFrame } from './BaseScreenLayout';

// 표지 없는 책, 그림 없는 캐릭터에 쓰는 대체 그림(회백 면 + 옅은 파랑 원 + 펼친 책).
// 화면에서 testImg.png 대신 쓴다: blockImg={story.coverImg || coverPlaceholder}
export { coverPlaceholder };

// 제목이 비어 있는 책을 부르는 이름. 책장·즐겨찾기·편집·홈·완성·읽기 화면이 같은 말을 쓴다
export const UNTITLED = '제목 없는 동화';

// 표지 그림. src가 비었거나 불러오지 못하면 대체 그림을 보인다. 나머지 props는 img로 간다.
export function CoverImg({ src, alt = '', onError, ...rest }) {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const broken = !src || brokenSrc === src;

  const handleError = (e) => {
    if (src && brokenSrc !== src) setBrokenSrc(src);
    if (onError) onError(e);
  };

  return <img src={broken ? coverPlaceholder : src} alt={alt} onError={broken ? undefined : handleError} {...rest} />;
}

// 대화상자 위의 표지 판: 옅은 판(PaperFrame) 위의 3:4 그림(모서리는 판보다 작은 둥글기). 책 열기, 내 캐릭터 상세가 같이 쓴다.
// 예) <Dialog media={<CoverPlate src={story.coverImg} />} …>
const Plate = styled(PaperFrame)`
  margin: 0 auto;
`;

const PlateImg = styled(CoverImg)`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: top;
  border-radius: ${({ theme }) => theme.radius.inner};
  background: ${({ theme }) => theme.colors.surface2};
`;

export function CoverPlate({ src, alt = '', maxWidth = '11rem' }) {
  return (
    <Plate $maxWidth={maxWidth}>
      <PlateImg src={src} alt={alt} />
    </Plate>
  );
}
