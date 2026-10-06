import React ,{ useEffect }from 'react';
import { Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { ThemeProvider } from 'styled-components';
import GlobalStyle from './styles/GlobalStyle';
import theme from './styles/theme';
import CharacterCreationScreen from './screens/CharacterCreationScreen';
import ConfirmCharacterScreen from './screens/ConfirmCharacterScreen';
import CharacterQuestionScreen from './screens/CharacterQuestionScreen.jsx';
import CharacterSelectScreen from './screens/CharacterSelectScreen';
import ResultScreen from './screens/ResultScreen';
import InteractiveStoryScreen from './screens/InteractiveStoryScreen.jsx';
import LoadingScreen from './screens/LoadingScreen';
import IntroScreen from './screens/IntroScreen';
import Bookshelf from './screens/Bookshelf';
import Favorite from './screens/Favorite';
import ReadingScreen from './screens/ReadingScreen';
import SettingsScreen from './screens/SettingsScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import StoryQuestionScreen from './screens/StoryQuestionScreen.jsx';
import CharacterStore from './screens/CharacterStore';
import EditBookshelf from './screens/EditBookshelf.jsx';
import ParentReportScreen from './screens/ParentReportScreen.jsx';
import SelectExistingCharacterScreen from './screens/SelectExistingCharacterScreen.jsx';
// 하단 고정 바
import BottomNav from './components/BottomNav';

// ToastContainer 전역 등록
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function PrivateRoute({ children }) {
  // --- 로그인 검증 (백연동 후 주석 해제) ---
  // const token = localStorage.getItem('jwt');
  // return token ? children : <Navigate to="/login" replace />;
  return <Outlet />;
}

function App() {

    useEffect(() => {
    const setVh = () => {
      // 브라우저 innerHeight의 1% 단위 값을 계산
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();  // 마운트 시 한 번 실행
    window.addEventListener('resize', setVh);  // 리사이즈 시 재계산
    return () => window.removeEventListener('resize', setVh);
  }, []);

  const location = useLocation();

  // 네비게이션 바 표시 여부를 결정
  // 네비바가 뜨길 원하면 아래처럼 작성
  const showNav =
    location.pathname === '/' ||
    location.pathname === '/book-storage' ||
    location.pathname === '/settings' ||
    location.pathname === '/favorites' ||
    location.pathname === '/character-storage';
  
  return (
    <ThemeProvider theme={theme}>
    <GlobalStyle/>
    <RecoilRoot>
      <ToastContainer
      position="top-center"
      autoClose={3000}
      hideProgressBar
      closeOnClick
      pauseOnHover
      />

      {/* 라우트 설정 */}
      <Routes>
        {/* 공개 페이지 */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />

        {/* 인증 필요 페이지 묶기 */}
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<IntroScreen />} />
          <Route path="create-character" element={<CharacterCreationScreen />} />
          <Route path="parent-report" element={<ParentReportScreen />} />
          <Route path="bookshelf" element={<Bookshelf />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="character-question" element={<CharacterQuestionScreen />} />
          <Route path="story-question" element={<StoryQuestionScreen />} />
          <Route path="confirm-character" element={<ConfirmCharacterScreen />} />
          <Route path="character-select" element={<CharacterSelectScreen />} />
          <Route path="select-existing-character" element={<SelectExistingCharacterScreen />} />
          <Route path="result" element={<ResultScreen />} />
          <Route path="confirm-story" element={<InteractiveStoryScreen />} />
          <Route path="loading" element={<LoadingScreen />} />
          <Route path="favorite" element={<Favorite />} />
          <Route path="character-storage" element={<CharacterStore />} />
          <Route path="reading" element={<ReadingScreen />} />
          <Route path="edit-bookshelf" element={<EditBookshelf />} />
        </Route>
      </Routes>

      {/* 모든 페이지에서 하단 고정 바 표시 */}
      {showNav && <BottomNav />}
    </RecoilRoot>
    </ThemeProvider>
  );
}

export default App;