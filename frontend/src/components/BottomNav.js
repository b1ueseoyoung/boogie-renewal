import React from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IoHomeOutline,
  IoHome,
  IoLibraryOutline,
  IoLibrary,
  IoHappyOutline,
  IoHappy,
  IoStarOutline,
  IoStar,
  IoEllipsisHorizontalCircle,
  IoEllipsisHorizontalCircleOutline,
} from 'react-icons/io5';
import Wordmark from './Wordmark';

// 주요 메뉴. App이 isNavRoute(pathname)로 그릴지 정하고, 화면 파일에서는 따로 그리지 않는다.
// 휴대폰: 아래에 붙은 흰 탭 막대(theme.layout.navH + safe-area, 위 가는 선). 넓은 화면(theme.mq.wide): 흰 위 막대(navHWide, 아래 가는 선), 왼쪽 '꿈도깨비', 오른쪽 알약 메뉴.
// 막대 높이를 바꾸면 PageShell 여백도 같이 바뀌도록 theme.layout 값만 고친다.

export const navItems = [
  {
    label: '내 캐릭터',
    path: '/character-storage',
    activeIcon: <IoHappy />,
    inactiveIcon: <IoHappyOutline />,
  },
  {
    label: '내 책장',
    path: '/bookshelf',
    activeIcon: <IoLibrary />,
    inactiveIcon: <IoLibraryOutline />,
  },
  {
    label: '홈',
    path: '/',
    activeIcon: <IoHome />,
    inactiveIcon: <IoHomeOutline />,
  },
  {
    label: '즐겨찾기',
    path: '/favorite',
    activeIcon: <IoStar />,
    inactiveIcon: <IoStarOutline />,
  },
  {
    label: '더보기',
    path: '/settings',
    activeIcon: <IoEllipsisHorizontalCircle />,
    inactiveIcon: <IoEllipsisHorizontalCircleOutline />,
  },
];

// 끝의 '/'는 떼고 비교한다('/bookshelf/'도 책장)
const normalize = (pathname) => pathname.replace(/\/+$/, '') || '/';

// 메뉴 막대를 보여 줄 경로인지: 메뉴 항목의 경로와 같은 화면에서만 보인다
export const isNavRoute = (pathname) => navItems.some((item) => item.path === normalize(pathname));

const NavBar = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${({ theme }) => theme.z.nav};
  display: flex;
  align-items: stretch;
  height: calc(${({ theme }) => theme.layout.navH} + env(safe-area-inset-bottom));
  padding: 0 calc(${({ theme }) => theme.space[1]} + env(safe-area-inset-right)) env(safe-area-inset-bottom)
    calc(${({ theme }) => theme.space[1]} + env(safe-area-inset-left));
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.lineTop};

  @media ${({ theme }) => theme.mq.wide} {
    top: 0;
    bottom: auto;
    align-items: center;
    gap: ${({ theme }) => theme.space[1]};
    height: ${({ theme }) => theme.layout.navHWide};
    /* 안쪽 끝을 PageShell 내용 끝과 맞춘다 */
    padding: 0 calc(max(0px, (100% - ${({ theme }) => theme.layout.page}) / 2) + ${({ theme }) => theme.layout.gutter});
    box-shadow: ${({ theme }) => theme.shadow.lineBottom};
  }
`;

// 넓은 화면 왼쪽의 '꿈도깨비'(홈으로). 휴대폰 탭 막대에는 없다
const HomeMark = styled.button`
  display: none;

  @media ${({ theme }) => theme.mq.wide} {
    display: inline-flex;
    align-items: center;
    min-height: ${({ theme }) => theme.tap};
    margin-right: auto;
    padding: ${({ theme }) => `0 ${theme.space[2]}`};
    margin-left: calc(-1 * ${({ theme }) => theme.space[2]});
    border: none;
    border-radius: ${({ theme }) => theme.radius.tag};
    background: none;
    cursor: pointer;
  }
`;

// 아이콘 자리. 휴대폰에서는 바탕 없이 색으로만 고른 메뉴를 보인다(넓은 화면은 NavItem이 알약을 깐다)
const IconPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 1.875rem;

  & svg {
    width: 1.375rem;
    height: 1.375rem;
  }

  @media ${({ theme }) => theme.mq.wide} {
    width: auto;
    height: auto;

    & svg {
      width: 1.25rem;
      height: 1.25rem;
    }
  }
`;

const NavItem = styled.button`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  min-height: ${({ theme }) => theme.tap};
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.tag};
  background: transparent;
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.display};
  /* 흰 막대 위: accent 5.17:1, inkMuted 4.62:1 */
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.inkMuted)};

  & svg {
    fill: currentColor;
  }

  /* 메뉴는 뜨거나 작아지지 않고 색만 바뀐다(전역 누름 반응보다 우선하게 클래스를 세 번 적는다) */
  &&&:active {
    scale: none;
  }

  @media ${({ theme }) => theme.mq.hover} {
    &:hover {
      color: ${({ $active, theme }) => ($active ? theme.colors.accentDeep : theme.colors.ink)};
    }
  }

  @media ${({ theme }) => theme.mq.wide} {
    flex: none;
    flex-direction: row;
    gap: ${({ theme }) => theme.space[2]};
    padding: ${({ theme }) => `0 ${theme.space[4]}`};
    border-radius: ${({ theme }) => theme.radius.pill};
    /* 고른 메뉴: 옅은 파랑 알약 위 accentDeep 글자 7.1:1, 나머지는 inkSoft 7.1:1 */
    background: ${({ $active, theme }) => ($active ? theme.colors.accentPale : 'transparent')};
    color: ${({ $active, theme }) => ($active ? theme.colors.accentDeep : theme.colors.inkSoft)};
  }

  @media ${({ theme }) => `${theme.mq.wide} and ${theme.mq.hover}`} {
    &:hover {
      background: ${({ $active, theme }) => ($active ? theme.colors.accentPale : theme.colors.surface2)};
      color: ${({ $active, theme }) => ($active ? theme.colors.accentDeep : theme.colors.ink)};
    }
  }
`;

const NavLabel = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: ${({ theme }) => theme.weight.medium};
  line-height: 1;
  white-space: nowrap;

  @media ${({ theme }) => theme.mq.wide} {
    font-size: ${({ theme }) => theme.text.md};
    font-weight: ${({ theme }) => theme.weight.semibold};
  }
`;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = normalize(location.pathname);

  return (
    <NavBar aria-label="주요 메뉴">
      <HomeMark type="button" onClick={() => navigate('/')} aria-label="꿈도깨비 홈">
        <Wordmark />
      </HomeMark>
      {navItems.map((item) => {
        const isActive = current === item.path;

        return (
          <NavItem
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            $active={isActive}
            aria-current={isActive ? 'page' : undefined}
          >
            <IconPill $active={isActive} aria-hidden="true">
              {isActive ? item.activeIcon : item.inactiveIcon}
            </IconPill>
            <NavLabel>{item.label}</NavLabel>
          </NavItem>
        );
      })}
    </NavBar>
  );
};

export default BottomNav;
