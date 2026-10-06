import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import App from './App';
import { RecoilRoot } from 'recoil';
import { BrowserRouter } from 'react-router-dom';

// Spring 세션 쿠키: 화면마다 직접 부르는 axios 호출(책장, 캐릭터 보관함)도 쿠키를 보낸다
axios.defaults.withCredentials = true;

ReactDOM.render(
  <React.StrictMode>
    <RecoilRoot>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RecoilRoot>
  </React.StrictMode>,
  document.getElementById('root')
);