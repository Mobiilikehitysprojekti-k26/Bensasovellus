# Bensasovellus

Tämä on React Native / Expo -sovellus, jonka ideana on auttaa käyttäjää löytämään järkevä tankkauspaikka Oulun alueella. Sovellus näyttää bensa-asemien hintoja, osaa hakea reittejä kartalla ja laskee myös arvioita siitä, voiko jollain tankkauspaikalla säästää rahaa.

Projekti on tehty mobiilisovelluksena. Käyttöliittymässä on kartta, hinnat, suodatus, profiili ja tankkaushistoria.

## Mitä sovelluksella voi tehdä

- Näyttää kartalla huoltoasemia.
- Näyttää huoltoaseman hinnat, kun aseman kuvaketta painetaan kartalla.
- Hakea reitin osoitteeseen.
- Aloittaa navigoinnin.
- Valita kartalta huoltoaseman ja painaa `Tankkaa täällä`.
- Katsoa polttoainehintoja listana.
- Suodattaa hintoja polttoaineen ja järjestyksen mukaan.
- Lisätä omia tankkauksia tankkaushistoriaan.
- Laskea arvioituja säästöjä tankkausten perusteella.
- Tallentaa käyttäjän ajoneuvon kulutuksen ja polttoainetyypin profiiliin.

## Käytetyt tekniikat

Sovellus on rakennettu näillä:

- Expo
- React Native
- TypeScript
- React Navigation
- React Native Paper
- React Native Maps
- AsyncStorage
- Expo Location
- OpenRouteService API
- OpenStreetMap-pohjainen karttanäkymä

Backend ei ole tässä repossa, mutta sovellus käyttää erillistä bensa-api-palvelinta hintojen ja kirjautumisen hakemiseen.

## Kartta ja navigointi

Karttanäkymä käyttää `react-native-maps`-kirjastoa. Itse karttatausta tulee OpenStreetMap-pohjaisista karttatiilistä. Käytössä on Carto/OSM-tyylinen tile-osoite:

```text
https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png
```

Reititys tehdään OpenRouteService API:lla. Sovellus käyttää kahta OpenRouteService-toimintoa:

- `directions/driving-car/geojson`
- `snap/driving-car/json`

`snap`-kutsulla alku- ja loppupisteitä yritetään siirtää järkevästi tien päälle. Tämän jälkeen haetaan varsinainen ajoreitti. Reitistä saadaan:

- reitin viiva kartalle
- matka metreinä
- arvioitu ajoaika
- ajo-ohjeet
- käännösten tiedot

Käyttäjän sijainti haetaan Expo Locationilla. Navigointitilassa sovellus seuraa käyttäjän sijaintia, päivittää kameraa ja näyttää yläreunassa seuraavan ajo-ohjeen.

## Polttoainehinnat

Hinnat haetaan backendistä. Tärkeimmät projektissa käytetyt endpointit on:

```text
GET /api/all
GET /api/fuel/95
GET /api/fuel/98
GET /api/fuel/diesel
```

Sovelluksessa käytetään API-avainta:

```text
EXPO_PUBLIC_DATABASE_API_KEY
```

Hinnat-sivulla asemat ryhmitellään aseman nimen mukaan. Yhden aseman alle näytetään eri polttoaineet, esimerkiksi:

- 95
- 98
- Diesel

## Suodatus

Hinnat-sivulta pääsee suodattamaan hintoja. Suodattimet tallennetaan paikallisesti AsyncStorageen.

Suodatuksessa voi valita:

- polttoaineet
- uusin ensin
- halvin ensin
- lähimpänä ensin
- ei järjestystä

## Tankkauslogiikka

Tankkauslogiikka toimii kahdessa eri kohdassa.

Ensimmäinen osa on reitin aikainen suositus. Kun käyttäjä hakee reitin, sovellus katsoo käyttäjän profiilista:

- auton yhdistetyn kulutuksen
- polttoainetyypin

Sen jälkeen sovellus hakee saman polttoainetyypin asemia backendistä. Asemista tehdään ehdokkaita. Sovellus vertailee esimerkiksi:

- aseman hintaa
- kuinka lähellä asema on reittiä
- paljonko ylimääräistä matkaa asemalle tulisi
- paljonko ylimääräinen ajo maksaa
- paljonko halvempi litrahinta voisi säästää

Perusidea on suunnilleen tämä:

```text
hintasäästö = tankattavat litrat * (vertailuhinta - aseman hinta)
ylimääräisen ajon kulu = lisämatka * kulutus * polttoaineen hinta
nettosäästö = hintasäästö - ylimääräisen ajon kulu
```

Jos hyvä säästö löytyy, sovellus suosittelee sitä. Jos selvää säästöä ei löydy, sovellus voi silti näyttää järkevän tankkauspaikan reitin varrelta. Silloin teksti voi kertoa, että säästöä ei arvioitu syntyvän tai että siitä tulisi pieni lisäkulu.

Toinen osa on tankkaushistoria. Kun käyttäjä lisää tankkauksen, sovellus tallentaa:

- aseman
- päivämäärän
- polttoaineen
- litrat
- litrahinnan
- kokonaishinnan
- säästöarvion

Säästöarvio lasketaan vertaamalla käyttäjän tankkausta backendin hintadataan. Jos käyttäjän tankkaama hinta on halvempi kuin vertailuhinta, se näkyy tankkaushistoriassa esimerkiksi näin:

```text
Säästetty: 3.40€
```

Profiilisivulla säästöt lasketaan yhteen tankkaushistoriasta.

## Käyttäjän tankkaukset ja hintadata

Sovelluksessa on tuki kirjautumiselle. Bearer-token tallennetaan kirjautumisen jälkeen AsyncStorageen. Tokenia voidaan käyttää suojattuihin endpointteihin.

Backend-dokumentaation mukaan:

```text
POST /api/me/refuels
```

tallentaa käyttäjän tankkauksen ja lisää samalla hintahavainnon jaettuun `fuel_prices`-historiaan. Sovelluksessa tankkauksen tallennus lähettää tämän kutsun, jos bearer-token löytyy.

Tämä tarkoittaa, että käyttäjän ilmoittama tuore hinta voi tulla mukaan Hinnat-sivulle. Sitä ei kuitenkaan näytetä erillisenä "käyttäjän tankkaus" -asemana, vaan se pyritään näyttämään saman aseman alla kuten muutkin hinnat. Uusin ensin -järjestys käyttää aikaleimaa, jotta tuore hinta voi nousta listan kärkeen.

## Paikallinen tallennus

Sovellus käyttää AsyncStoragea. Sinne tallennetaan esimerkiksi:

- kirjautunut käyttäjä
- bearer-token
- profiilin ajoneuvoasetukset
- tankkaushistoria
- hinnat-sivun suodattimet

Tankkaushistoria on käyttäjäkohtainen. Tämä on tärkeää, koska samalla puhelimella voi kirjautua eri käyttäjillä. Vanhan käyttäjän tankkaukset eivät saa näkyä uudelle käyttäjälle.

## Profiili

Profiilissa käyttäjä voi asettaa ajoneuvon tiedot. Tärkeimmät ovat:

- ajoneuvon nimi
- yhdistetty kulutus, esimerkiksi `6.5`
- polttoaine, eli 95, 98 tai diesel

Ilman kulutusta ja polttoainetta sovellus ei voi kunnolla laskea tankkausasemien säästöjä. Siksi kartta näyttää ilmoituksen, jos näitä tietoja puuttuu ja käyttäjä yrittää käyttää säästöihin perustuvaa navigointia.

## Projektin rakenne

Tärkeimpiä kansioita ja tiedostoja:

```text
App.tsx
navigation/
screens/
components/
services/
storage/
utils/
theme.ts
```

`screens` sisältää näkymät, kuten kartan, hinnat, profiilin ja tankkaushistorian.

`components` sisältää isompia käyttöliittymäkomponentteja. Kartta on siellä.

`services` sisältää reitityksen, geokoodauksen ja säästölaskennan logiikkaa.

`storage` sisältää AsyncStorageen liittyvät apufunktiot.

## Käynnistäminen

Asenna riippuvuudet:

```bash
npm install
```

Käynnistä Expo:

```bash
npx expo start
```



## Ympäristömuuttujat

Sovellus tarvitsee ainakin nämä:

```text
EXPO_PUBLIC_DATABASE_API_KEY
EXPO_PUBLIC_OPENROUTESERVICE_API_KEY
```

Ensimmäistä käytetään bensa-api-palvelimen suojattuihin hintakutsuihin. Toista käytetään OpenRouteService-reittihakuun ja geokoodaukseen.
