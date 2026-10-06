import React from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IoHomeOutline,
  IoHome,
  IoFolderOpenOutline,
  IoFolderOpen,
  IoPersonOutline,
  IoPerson,
  IoStarOutline,
  IoStar,
  IoEllipsisHorizontalSharp,
  IoEllipsisHorizontalOutline,
} from 'react-icons/io5';

// 휴대폰: 아래에 붙은 탭 막대. 넓은 화면(56rem 이상): 위에 붙은 막대, 왼쪽에 이름, 오른쪽에 알약 메뉴
const NavBar = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4rem;
  display: flex;
  align-items: stretch;
  padding-bottom: env(safe-area-inset-bottom);
  background: ${({ theme }) => theme.colors.surface};
  border-top: ${({ theme }) => theme.border.rule};
  box-shadow: 0 -0.5rem 1.5rem -1rem rgba(91, 64, 34, 0.25);
  z-index: 10;

  @media (min-width: 56rem) {
    top: 0;
    bottom: auto;
    height: 4.5rem;
    align-items: center;
    gap: ${({ theme }) => theme.space[2]};
    padding: 0 max(${({ theme }) => theme.space[6]}, calc((100% - 74rem) / 2 + ${({ theme }) => theme.space[4]}));
    background: ${({ theme }) => theme.colors.bg};
    border-top: none;
    border-bottom: ${({ theme }) => theme.border.rule};
    box-shadow: none;
  }
`;

const Wordmark = styled.button`
  display: none;

  @media (min-width: 56rem) {
    display: block;
    margin-right: auto;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: ${({ theme }) => theme.text.xl};
    color: ${({ theme }) => theme.colors.ink};

    & > span {
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

const NavItem = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[1]};
  min-height: ${({ theme }) => theme.tap};
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.inkSoft)};

  & svg {
    fill: currentColor;
  }

  &:hover {
    color: ${({ $active, theme }) => ($active ? theme.colors.accentDeep : theme.colors.ink)};
  }

  @media (min-width: 56rem) {
    flex: none;
    flex-direction: row;
    gap: ${({ theme }) => theme.space[2]};
    padding: ${({ theme }) => `0 ${theme.space[4]}`};
    border-radius: ${({ theme }) => theme.radius.btn};
    background: ${({ $active, theme }) => ($active ? theme.colors.accentPale : 'transparent')};

    &:hover {
      background: ${({ $active, theme }) => ($active ? theme.colors.accentPale : theme.colors.surface2)};
    }
  }
`;

const NavLabel = styled.span`
  font-size: ${({ theme }) => theme.text.sm};
  line-height: 1;

  @media (min-width: 56rem) {
    font-size: ${({ theme }) => theme.text.base};
  }
`;

const navItems = [
  {
    label: '내 캐릭터',
    path: '/character-storage',
    activeIcon: <IoPerson size={20} />,
    inactiveIcon: <IoPersonOutline size={20} />,
  },
  {
    label: '내 책장',
    path: '/bookshelf',
    activeIcon: <IoFolderOpen size={20} />,
    inactiveIcon: <IoFolderOpenOutline size={20} />,
  },
  {
    label: '홈',
    path: '/',
    activeIcon: <IoHome size={20} />,
    inactiveIcon: <IoHomeOutline size={20} />,
  },
  {
    label: '즐겨찾기',
    path: '/favorite',
    activeIcon: <IoStar size={20} />,
    inactiveIcon: <IoStarOutline size={20} />,
  },
  {
    label: '더보기',
    path: '/settings',
    activeIcon: <IoEllipsisHorizontalSharp size={20} />,
    inactiveIcon: <IoEllipsisHorizontalOutline size={20} />,
  },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <NavBar aria-label="주요 메뉴">
      <Wordmark type="button" onClick={() => navigate('/')} aria-label="꿈도깨비 홈">
        꿈<span>도깨비</span>
      </Wordmark>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;

        return (
          <NavItem
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            $active={isActive}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive ? item.activeIcon : item.inactiveIcon}
            <NavLabel>{item.label}</NavLabel>
          </NavItem>
        );
      })}
    </NavBar>
  );
};

export default BottomNav;
