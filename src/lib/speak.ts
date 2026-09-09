import * as Speech from 'expo-speech';

// 用系统 TTS 朗读英文单词。离线、零成本。
export function speak(word: string): void {
  Speech.stop();
  Speech.speak(word, { language: 'en-US', rate: 0.9, pitch: 1.0 });
}
