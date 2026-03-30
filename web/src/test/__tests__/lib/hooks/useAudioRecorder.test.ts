import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder';

// Mock MediaRecorder
class MockMediaRecorder {
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  static isTypeSupported(type: string) {
    return type === 'audio/webm;codecs=opus';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    // Simulate data available then stop
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

// Mock getUserMedia
function createMockGetUserMedia(shouldSucceed = true) {
  const mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
  };

  return vi.fn().mockImplementation(() => {
    if (shouldSucceed) {
      return Promise.resolve(mockStream);
    }
    return Promise.reject(new DOMException('Permission denied'));
  });
}

describe('useAudioRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set up globals
    Object.defineProperty(global, 'MediaRecorder', {
      writable: true,
      value: MockMediaRecorder,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts recording and tracks duration', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: createMockGetUserMedia(true) },
    });

    const onRecordingComplete = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecordingComplete }));

    expect(result.current.isRecording).toBe(false);
    expect(result.current.duration).toBe(0);

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(true);

    // Advance timer by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.duration).toBe(3);
  });

  it('stops recording and produces a file', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: createMockGetUserMedia(true) },
    });

    const onRecordingComplete = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecordingComplete }));

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isRecording).toBe(false);
    expect(onRecordingComplete).toHaveBeenCalledTimes(1);

    const file = onRecordingComplete.mock.calls[0][0];
    expect(file).toBeInstanceOf(File);
    expect(file.name).toMatch(/^recording-.*\.webm$/);
    expect(file.type).toBe('audio/webm;codecs=opus');
  });

  it('sets error when microphone access is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: createMockGetUserMedia(false) },
    });

    const onRecordingComplete = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecordingComplete }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBe(
      'Microphone access denied. Please allow microphone access in your browser settings.'
    );
    expect(onRecordingComplete).not.toHaveBeenCalled();
  });

  it('clears error via clearError', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: createMockGetUserMedia(false) },
    });

    const onRecordingComplete = vi.fn();
    const { result } = renderHook(() => useAudioRecorder({ onRecordingComplete }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('cleans up on unmount during recording', async () => {
    const mockStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockStop }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    });

    const onRecordingComplete = vi.fn();
    const { result, unmount } = renderHook(() => useAudioRecorder({ onRecordingComplete }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(true);

    unmount();

    expect(mockStop).toHaveBeenCalled();
  });
});
