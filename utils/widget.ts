import { NativeModules } from 'react-native';

const { WidgetDataModule } = NativeModules;

export function updateWidgetData(data: {
  isLoggedIn?: boolean;
  eggCount: string;
  temperature: string;
  humidity: string;
  timestamp: string;
}) {
  if (WidgetDataModule) {
    WidgetDataModule.updateWidgetData({ isLoggedIn: true, ...data });
  }
}

export function setWidgetLoggedOut() {
  if (WidgetDataModule) {
    WidgetDataModule.updateWidgetData({
      isLoggedIn: false,
      eggCount: '',
      temperature: '',
      humidity: '',
      timestamp: '',
    });
  }
}
