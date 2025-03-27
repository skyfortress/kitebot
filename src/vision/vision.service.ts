import { Observation } from '@app/mongodb/types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VisionService {
  async analyzeImage(path: string): Promise<Observation> {
    try {
      const response = await fetch(`http://192.168.2.2:8000/?imagePath=${path}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }
}
