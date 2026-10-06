import styled, { keyframes } from 'styled-components';

const turn = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.colors.scrim};
  z-index: 100;
`;

const Box = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  width: min(100%, 32rem);
  padding: ${({ theme }) => theme.space[5]};
  background: ${({ theme }) => theme.colors.accentPale};
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.card};
`;

const Spinner = styled.svg`
  width: 2rem;
  height: 2rem;
  flex: none;
  animation: ${turn} 1.4s linear infinite;

  & circle {
    stroke: ${({ theme }) => theme.colors.accentTrack};
  }

  & path {
    stroke: ${({ theme }) => theme.colors.accent};
  }
`;

const Text = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
`;

const Clock = styled.p`
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

export default function WaitingOverlay({ message, elapsed }) {
  return (
    <Overlay role="status" aria-live="polite" aria-busy="true">
      <Box>
        <Spinner viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="19" fill="none" strokeWidth="6" />
          <path d="M24 5a19 19 0 0 1 19 19" fill="none" strokeWidth="6" strokeLinecap="round" />
        </Spinner>
        <div>
          <Text>{message}</Text>
          {typeof elapsed === 'number' && <Clock>{elapsed}초 지났어요</Clock>}
        </div>
      </Box>
    </Overlay>
  );
}
