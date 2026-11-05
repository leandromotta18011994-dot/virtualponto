// Integração Lovable desabilitada para produção (remove botão "Edit in Lovable" do APK)
// Este arquivo mantém a interface compatível mas desativa funcionalidades de desenvolvimento.

type OAuthProvider = string;
type SignInOptions = { redirect_uri?: string; extraParams?: Record<string, string> };

export const lovable = {
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signInWithOAuth: async (_provider: OAuthProvider, _opts?: SignInOptions) => {
      return { error: new Error("OAuth desabilitado nesta versão.") };
    },
  },
};
