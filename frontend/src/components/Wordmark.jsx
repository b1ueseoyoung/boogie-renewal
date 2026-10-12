import React from 'react';
import styled from 'styled-components';
import logoMark from '../assets/brand/logo-mark.svg';

// '꿈도깨비' 가로형 로고: 도깨비 마크 + Pretendard 800 글자('꿈' ink, '도깨비' accent).
// 메뉴 막대, 홈(휴대폰), 로그인·가입 카드가 같은 모양을 쓴다.
// 크기는 font-size 하나로 정한다(기본 text.xl 22px). 마크는 글자의 1.4배(1.4em), 마크와 글자 사이는 마크 폭의 0.2(0.28em).
// 자리와 크기는 감싸는 쪽이 정한다. 예) const Brand = styled(Wordmark)`order: -1;`
// 마크는 꾸밈 그림(alt="")이고 이름은 글자로 남겨, 스크린 리더는 '꿈도깨비'를 읽는다.
const Mark = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.28em;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: ${({ theme }) => theme.weight.heavy};
  line-height: 1;
  letter-spacing: ${({ theme }) => theme.tracking.logo};
  color: ${({ theme }) => theme.colors.ink};
  white-space: nowrap;
`;

const Symbol = styled.img`
  display: block;
  flex: none;
  width: 1.4em;
  height: 1.4em;
`;

const Accent = styled.span`
  color: ${({ theme }) => theme.colors.accent};
`;

export default function Wordmark({ className }) {
  return (
    <Mark className={className}>
      <Symbol src={logoMark} alt="" aria-hidden="true" />
      <span>
        꿈<Accent>도깨비</Accent>
      </span>
    </Mark>
  );
}
