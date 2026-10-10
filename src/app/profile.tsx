import { router } from 'expo-router';
import { ProfileForm } from '@/components/ProfileForm';
import { Screen, success } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';

export default function ProfileScreen() {
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  return (
    <Screen edges={[]}>
      <ProfileForm
        initial={profile}
        submitLabel="Save"
        onSubmit={async (p) => {
          await setProfile(p);
          success();
          router.back();
        }}
      />
    </Screen>
  );
}
