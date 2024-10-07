import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

const RootLayout = () => {
  useEffect(() => {
    SplashScreen.hideAsync(); 
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(gallery)" options={{ headerShown: false }} />
    </Stack>
  );
};

export default RootLayout;