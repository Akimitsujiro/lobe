import { signIn, signOut } from 'next-auth/react';
import useSWR, { SWRResponse, mutate } from 'swr';
import { StateCreator } from 'zustand/vanilla';

import { enableClerk, enableNextAuth } from '@/const/auth';
import { UserConfig, userService } from '@/services/user';
import { switchLang } from '@/utils/client/switchLang';
import { setNamespace } from '@/utils/storeDebug';

import { UserStore } from '../../store';
import { settingsSelectors } from '../settings/selectors';

const n = setNamespace('auth');
const USER_CONFIG_FETCH_KEY = 'fetchUserConfig';

export interface UserAuthAction {
  getUserConfig: () => void;
  login: () => Promise<void>;
  /**
   * universal logout method
   */
  logout: () => Promise<void>;
  /**
   * universal login method
   */
  openLogin: () => Promise<void>;
  openUserProfile: () => Promise<void>;
  refreshUserConfig: () => Promise<void>;

  useFetchUserConfig: (initServer: boolean) => SWRResponse<UserConfig | undefined>;
}

export const createAuthSlice: StateCreator<
  UserStore,
  [['zustand/devtools', never]],
  [],
  UserAuthAction
> = (set, get) => ({
  getUserConfig: () => {
    console.log(n('userconfig'));
  },
  login: async () => {
    // TODO: 针对开启 next-auth 的场景，需要在这里调用登录方法
    console.log(n('login'));

    // Currently disable the condition to judge the login method
    // ref: https://github.com/lobehub/lobe-chat/pull/2364
    // if (enableNextAuth) {
    // TODO: 应该条件调用 next-auth 的登陆 hook
    signIn();
    // }
  },
  logout: async () => {
    if (enableClerk) {
      get().clerkSignOut?.({ redirectUrl: location.toString() });

      return;
    }

    // Disable the condition,
    // if (enableNextAuth) {
    // TODO: 针对开启 next-auth 的场景，需要在这里调用登录方法
    console.log(n('logout'));
    signOut();
    // }
  },
  openLogin: async () => {
    if (enableClerk) {
      console.log('fallbackRedirectUrl:', location.toString());

      get().clerkSignIn?.({ fallbackRedirectUrl: location.toString() });

      return;
    }

    // if (enableNextAuth) {
    // TODO: 针对开启 next-auth 的场景，需要在这里调用登录方法
    signIn();
    // }
  },
  openUserProfile: async () => {
    if (enableClerk) {
      get().clerkOpenUserProfile?.();

      return;
    }

    if (enableNextAuth) {
      // TODO: 针对开启 next-auth 的场景，需要在这里调用打开 profile 页
      // NextAuht 没有 profile 页，未来应该隐藏 Profile Button
    }
  },
  refreshUserConfig: async () => {
    await mutate([USER_CONFIG_FETCH_KEY, true]);

    // when get the user config ,refresh the model provider list to the latest
    get().refreshModelProviderList();
  },

  useFetchUserConfig: (initServer) =>
    useSWR<UserConfig | undefined>(
      [USER_CONFIG_FETCH_KEY, initServer],
      async () => {
        if (!initServer) return;
        return userService.getUserConfig();
      },
      {
        onSuccess: (data) => {
          if (!data) return;

          set(
            { avatar: data.avatar, settings: data.settings, userId: data.uuid },
            false,
            n('fetchUserConfig', data),
          );

          // when get the user config ,refresh the model provider list to the latest
          get().refreshDefaultModelProviderList({ trigger: 'fetchUserConfig' });

          const { language } = settingsSelectors.currentSettings(get());
          if (language === 'auto') {
            switchLang('auto');
          }
        },
        revalidateOnFocus: false,
      },
    ),
});
