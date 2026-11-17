# Web Pavel Koch: nasazení a správa

Web je statický: žádné předplatné ani databáze. Hosting Netlify je zdarma. Platí se jen doména (pokud ji chcete), řádově stovky korun ročně.

## Jednorázové nasazení (asi 30 minut)

1. **GitHub**: založte účet na github.com (může být tátův) a vytvořte nový repozitář `pavel-koch-web` (Private).
   Nahrajte do něj obsah této složky: *Add file → Upload files*, přetáhnout vše, *Commit changes*.
2. **Netlify**: zaregistrujte se na netlify.com přes GitHub. *Add new project → Import an existing project → GitHub →* vyberte `pavel-koch-web` a dejte *Deploy*. Nic se nenastavuje, build není potřeba.
3. **Přihlášení do administrace**:
   - na GitHubu: *Settings → Developer settings → OAuth Apps → New OAuth App*
     - Homepage URL: adresa webu z Netlify (např. `https://pavel-koch.netlify.app`)
     - Authorization callback URL: `https://api.netlify.com/auth/done`
   - zkopírujte *Client ID* a vygenerujte *Client secret*
   - v Netlify: *Project configuration → Access & security → OAuth → Install provider → GitHub* a vložte oba údaje
4. V souboru `admin/config.yml` přepište řádek `repo:` na `VAS-GITHUB-UZIVATEL/pavel-koch-web` (přímo na GitHubu přes ikonu tužky).
5. **Poptávky z formuláře**: v Netlify *Forms → Enable form detection*, pak udělat nový deploy. V *Forms → Notifications* nastavte e-mail, kam mají poptávky chodit.
6. **Doména** (nepovinné): kupte např. `pavelkoch.cz` u českého registrátora a v Netlify ji přidejte v *Domain management*. HTTPS se zapne samo.

## Jak táta přidá dílo

1. Otevře `adresa-webu/admin` a přihlásí se přes GitHub.
2. *Díla → Všechna díla → Přidat dílo* (nové se přidá nahoru).
3. Nahraje fotku nebo víc fotek, vyplní název, rok, techniku, **šířku a výšku v cm** (podle nich funguje úvodní zeď i „Velikost v prostoru“) a stav.
4. Klikne *Publikovat → Publikovat nyní*. Do minuty je dílo na webu.

Pořadí na webu = pořadí v seznamu (dá se přetáhnout). Prodané dílo stačí přepnout na *Prodáno*.

**Fotky:** rovně, bez rámu okolního prostředí, denní světlo, ideálně ořízlé přesně po hranu obrazu. Na webu se samy zmenší a zrychlí (Netlify Image CDN).

## Ukázková data
Obrazy ve složce `images/dila` a jejich názvy jsou zatím zástupné. Před spuštěním je smažte v administraci a nahraďte skutečnými. Plastika a životopis jsou skutečné.
