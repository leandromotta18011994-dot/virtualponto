# Gerar o .apk no Android Studio

O app "Banco de Horas" já vem com o projeto Android pronto na pasta `android/`.
Ele é uma casca: abre o app publicado (https://virtualponto.lovable.app) dentro do celular,
então login e banco de dados funcionam igual ao site.

## 1. Preparar o computador

1. Instale o Android Studio: https://developer.android.com/studio (Windows, macOS ou Linux).
2. Na primeira abertura, deixe que ele baixe o SDK do Android (Android SDK Platform 36 e
   Android SDK Build-Tools). Isso é feito em **Settings > Appearance & Behavior >
   System Settings > Android SDK**, marcando as opções e clicando em Apply.

## 2. Baixar o projeto

1. Baixe o código do projeto (menu do projeto > download/exportar código).
2. Descompacte em uma pasta simples, por exemplo `C:\bancodehoras` ou `~/bancodehoras`.

## 3. Abrir no Android Studio

1. Abra o Android Studio e escolha **File > Open**.
2. Selecione a pasta **`android`** que está dentro do projeto (não a pasta raiz).
3. Espere o "Gradle sync" terminar — na primeira vez demora alguns minutos
   (ele baixa o Gradle 8.14.3 e as bibliotecas).

## 4. Gerar o .apk

- Menu **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
- Aguarde a mensagem "APK(s) generated successfully" e clique em **locate**.
- O arquivo fica em:
  - `android/app/build/outputs/apk/debug/app-debug.apk`

Atalho pelo terminal (na pasta do projeto):

```bash
bun install
bun run apk:build      # gera o app-debug.apk
bun run apk:open       # abre a pasta android direto no Android Studio
```

## 5. Instalar no celular

1. Copie o `app-debug.apk` para o celular (cabos, Drive, WhatsApp, etc.).
2. No celular, toque no arquivo e autorize **instalar de fontes desconhecidas**
   para o app que você usou para abrir.
3. Pronto: o app "Banco de Horas" aparece na tela inicial.

## 6. Versão para distribuir (opcional)

O `app-debug.apk` serve para teste. Para enviar à Play Store ou distribuir de forma
oficial, é preciso assinar o app:

1. **Build > Generate Signed App Bundle / APK > APK**.
2. **Create new...** keystore, preencha a senha e os dados, e guarde esse arquivo `.jks`
   com a senha — sem ele não é possível atualizar o app depois.
3. Escolha **release** e gere. O arquivo fica em
   `android/app/build/outputs/apk/release/app-release.apk`.

## Observações

- O app aponta para `https://virtualponto.lovable.app`. Se quiser que ele abra um endereço
  próprio (domínio da empresa), mude `server.url` em `capacitor.config.ts` e rode
  `bun run apk:sync` antes de gerar o .apk de novo.
- Se o login por Google não funcionar dentro do APK, adicione o ID e a chave SHA-1 do app
  na tela de credenciais do provedor Google (o SHA-1 aparece no Android Studio em
  **Gradle > :app > Tasks > android > signingReport**).
- Para testar em um aparelho físico conectado por cabo USB, basta ativar a
  **depuração USB** no celular e clicar no botão **Run** (triângulo verde) no Android Studio.

## Versão assinada para a Play Store

1. **Criar a chave (uma vez só):** no terminal, na pasta do projeto: `bun run apk:keystore`. Responda nome/empresa e crie uma senha. Gera `android/banco-de-horas.jks`.
   > Guarde esse arquivo e a senha em local seguro. Sem eles você nunca mais consegue atualizar o app na Play Store.
2. Copie `android/keystore.properties.example` para `android/keystore.properties` e coloque sua senha.
3. **Gerar o pacote da Play Store (.aab):** `bun run aab:release` → arquivo em `android/app/build/outputs/bundle/release/app-release.aab`.
   (APK assinado, se precisar: `bun run apk:release` → `android/app/build/outputs/apk/release/`.)
   Pelo Android Studio também dá: **Build > Generate Signed Bundle / APK > Android App Bundle**.
4. **Enviar:** play.google.com/console (taxa única de US$ 25) → Criar app → Produção → Criar versão → enviar o `.aab`. Preencha ficha da loja, política de privacidade e classificação.
5. **Atualizações:** aumente `versionCode` (ex.: 2) e `versionName` em `android/app/build.gradle` antes de cada novo envio.
