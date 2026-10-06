import { atom } from 'recoil';
import testImg from '../assets/images/마법사 유원이.webp';
import 코코1 from '../assets/images/코코1.png';
import 코코2 from '../assets/images/코코2.png';

export const characterInfoState = atom({
  key: 'characterInfo',
  default: [
    {
      id: '0',
      name: '',
      age: '',
      gender: '',
      job: '',
      speciality: '',
      ability:'',
      note: '',
      charId: null, // 고른 캐릭터가 없으면 흐름 화면이 /character-select로 보낸다
      img: '',
      userImg: '',
    },
  ],
});

export const storyCreationState = atom({
  key: 'storyCreationState',
  // 새로고침하면 이 빈 값으로 돌아간다. step 0이면 이야기 화면이 /character-select로 보낸다.
  default: {
    charId: null,
    genre: '',
    place: '',
    history: [],
    story: '',
    question: '',
    image: '',
    choices: [],
    step: 0,                       // 현재 진행 단계 (도입부를 받으면 1)
    selectedChoice: '',           // 마지막 선택 값
  },
});

export const storyInfoState = atom({
  key: 'storyInfo',
  default: [
    {
      id: '1',
      title: '코코의 모험기',
      date: '2025.02.01',
      favorite: 'false',
      summary: '마법사 코코와 네로와 함께하는 모험 이야기',
      img: Array(10).fill(코코1),
      cover: testImg,
      characters: ['코코'], // 
    },
    {
      id: '2',
      title: '마법사 코코',
      date: '2025.02.01',
      favorite: 'false',
      summary: '마법사 코코와 네로와 함께하는 모험 이야기',
      img: Array(10).fill(코코2),
      cover: testImg,
      characters: ['코코'], // 
    },
  ],
});

// 로그인한 사람. null이면 아직 모르거나 로그인 전(PrivateRoute가 GET /me로 채운다)
export const authUserState = atom({
  key: 'authUser',
  default: null, // { userId, userName }
});

export const conversationState = atom({
  key:'conversation',
  default:[{
    conversationId:'',// 메세지 한줄한줄이 들어있는 대화 한 묶음
    userId:'',
    characterId:'',
    qType:'', //질문 종류 
  }]
});

export const messageState = atom({
  key: 'message',
  default: [{
    conversationId: '',
    speaker: '',
    message: '',
    timestamp: '',
  }]
});

export const favoriteStoryIdsState = atom({
  key: 'favoriteStoryIdsState',
  default: [],
});

export const isStoryGeneratedState = atom({
  key: 'isStoryGeneratedState',
  default: false,      // 줄거리 생성 전에는 false
});

export const coverImageState = atom({
  key: 'coverImageState',
  default: '',
});