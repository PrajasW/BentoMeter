import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiKeyForm } from '@/components/ApiKeyForm';
import { Mascot } from '@/components/Mascot';
import { ProfileForm } from '@/components/ProfileForm';
import { Button, Screen, success, Txt } from '@/components/ui';
import type { Profile } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const profile = useAppStore((s) => s.profile);
  const apiKey = useAppStore((s) => s.apiKey);
  const setProfile = useAppStore((s) => s.setProfile);
  const setKey = useAppStore((s) => s.setApiKey);

  const finish = () => {
    success();
    router.replace('/');
  };

  return (
    <Screen>
      <View style={{ height: 8 }} />
      {step === 0 && (
        <View style={{ alignItems: 'center', gap: 16, paddingTop: 60 }}>
          <Mascot size={140} mood="wink" bounce />
          <Txt variant="display">BentoMeter</Txt>
          <Txt variant="jp" style={{ fontSize: 14 }}>
            べんとうメーター
          </Txt>
          <Txt variant="body" soft style={{ textAlign: 'center', paddingHorizontal: 16 }}>
            Snap your meal, and I'll count the calories and suggest what to eat next. Let's set things up! 🍙
          </Txt>
          <View style={{ height: 24 }} />
          <Button title="Let's go ✨" onPress={() => setStep(1)} style={{ alignSelf: 'stretch' }} />
        </View>
      )}

      {step === 1 && (
        <>
          <View>
            <Txt variant="title">About you</Txt>
            <Txt variant="jp">あなたについて</Txt>
          </View>
          <Txt variant="body" soft>
            Used to work out your daily calorie target. You can change it any time.
          </Txt>
          <ProfileForm
            initial={profile}
            submitLabel="Next"
            onSubmit={async (p: Profile) => {
              await setProfile(p);
              setStep(2);
            }}
          />
        </>
      )}

      {step === 2 && (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Mascot size={88} mood="yum" />
          </View>
          <View>
            <Txt variant="title">Connect Gemini</Txt>
            <Txt variant="jp">AIとつなぐ</Txt>
          </View>
          <Txt variant="body" soft>
            BentoMeter sends your meal photo to Google Gemini to recognise foods and estimate calories.
          </Txt>
          <ApiKeyForm
            initial={apiKey}
            saveLabel="Save & start"
            onSave={async (k) => {
              await setKey(k);
              finish();
            }}
          />
          <Button title="Skip for now" kind="ghost" onPress={finish} />
        </>
      )}
    </Screen>
  );
}
