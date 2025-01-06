import { Observation, Spot } from '@app/mongodb/types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VisionService {
  async analyzeImage(spot: Spot, path: string): Promise<Observation> {
    try {
      const response = await fetch(`http://127.0.0.1:8000/?imagePath=${path}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      data.spot = spot.name;
      return data;
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }
}
