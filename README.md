## Ônibus DF (Brasília) — App Mobile

App em React Native (Expo) para visualizar ônibus e paradas do Distrito Federal (Brasília, Brasil), com mapa OpenStreetMap e localização do usuário.

- Mapa: OpenStreetMap via WebView + Leaflet
- UI base: Expo + TypeScript



## Requisitos

- Node.js LTS (18+ recomendado)
- npm (ou pnpm/yarn)
- Expo CLI (via `npx`) e app Expo Go (opcional para testar no dispositivo)
- Para Android (emulador/compilar local): Android Studio + SDKs

## Instalação

1) Clonar e instalar dependências

```bash
git clone https://github.com/devyat009/bus-tracker
cd bus-tracker
npm install
```

2) Iniciar em modo desenvolvimento

```bash
npm run android:dev
```

Abra no:
- Emulador Android (Android Studio)
- Dispositivo físico com Expo Go (escaneando o QR code)

Observação: conceda permissão de localização quando solicitado para que o botão “me encontrar” funcione e o mapa recentre na sua posição.

## Compilação (Build — padrão Expo)

Build local para Android com Expo:

Pré-requisitos: Android Studio instalado e variáveis do SDK configuradas.

```bash
npx expo prebuild
npx expo run:android
```

Isso cria e instala um build de desenvolvimento no emulador/dispositivo conectado.

Observação (iOS): `npx expo run:ios` requer macOS com Xcode.

ou
```bash
npx expo eject
```
```bash
cd android
./gradlew assembleRelease
```
apk location
bus-tracker\android\app\build\outputs\apk\release


## Licença

Este repositório é para fins educacionais/demonstração.
