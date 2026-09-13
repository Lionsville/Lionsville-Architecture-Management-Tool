# Benutzerhandbuch

Das Lionsville Architecture Management Tool zeichnet eine Anwendungslandschaft
in Layer-7-Bändern und die C4-Container-Diagramme darunter. Dies ist das
Handbuch für die Benutzung. Was es ist und warum es existiert, steht in der
[README](../README.md); dieses Handbuch gibt es auch auf
[Englisch](manual.en.md), [Niederländisch](manual.nl.md) und
[Friesisch](manual.fy.md).

## Erste Schritte

**Desktop.** Laden Sie das Installationsprogramm für Ihre Plattform von der
[Release-Seite](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest).
Die App sieht im Hintergrund auf dieser Seite nach, ob es eine neuere Version
gibt, und sagt es Ihnen, wenn es eine gibt — **Download…** öffnet das
Installationsprogramm in Ihrem Browser, **Skip This Version** sagt: diese
nicht, und das Kontrollkästchen in diesem Dialog schaltet die automatische
Prüfung aus. Nichts installiert sich von selbst. **Check for Updates…** im
App-Menü fragt auf Wunsch nach.

**Browser.** Aus einem Klon des Repositorys einmal `npm run setup`, danach
`npm run dev`; öffnen Sie <http://127.0.0.1:5200>. Wo der Browser es anbietet
— Chromium tut das — kann ein Tab genau wie der Desktop in einem Ordner
arbeiten. Wo nicht, lebt alles, was Sie anlegen, im Speicher dieses Browsers,
bis Sie eine Datei speichern.

In beiden Fällen verlässt nichts Ihren Rechner. Es gibt kein Konto, kein
Backend und keine Telemetrie.

## Der Organisationsbildschirm

Die App öffnet sich auf der **Organisation** — dem Arbeitsordner selbst, der ein
Bereich wie jeder andere ist und derjenige, unter dem alles andere abgelegt
ist. Ein **Bereich** ist ein Dokument: ein Name, eine Landschaft, die
Container-Diagramme darunter, die Entscheidungen, die Pläne, die
Geschäftsarchitektur, und alles, was darauf platziert ist. Bereiche sind
**geschachtelt**, und jeder von ihnen ist dasselbe Dokument — die Organisation
ganz oben, eine **Domäne** darunter, eine **Landschaft** darunter, so tief, wie
Ihre Arbeit es braucht.

Der Bildschirm ist das Zuhause der Organisation und keine Liste von
Dokumenten, und er hat vier Teile.

![Der Organisationsbildschirm: der Name und die Links oben, die eigenen Seiten der Organisation als Karten, der Baum der Domänen und Landschaften, und zuletzt die Beispiele](screenshot-organisation.png)

**Ihre Identität**, ganz oben: der Name, der Auftraggeber, wenn die Zeichnungen
für jemand anderen angefertigt werden, wie viele Domänen und Landschaften
darunter abgelegt sind, wann sich zuletzt etwas darin geändert hat, die
Beschreibung und ihre Links. Ein Ordner, den noch niemand benannt hat, fragt
hier nach einem Namen, statt eine Überschrift zu zeigen.

**Ihre eigenen Seiten**, als vier Karten. **Geschäftsarchitektur** zählt die
Kundenreisen, Bereiche, Funktionen und Beteiligten, die die Organisation selbst
hält, und sagt, wie viele Funktionen noch keiner Domäne übergeben wurden;
**Entscheidungen** zählt ihre Einträge nach Status und nennt den neuesten;
**Fahrplan** zählt ihre Pläne und zeigt das Erste, worüber deren Daten uneins
sind. **Register** zählt jede Anwendung im ganzen Ordner, wie viele davon eine
Domäne verantwortet und wie viele jemand anderem gehören, und sagt, worin sich
das Register widerspricht. Jede Karte öffnet, was sie zählt; das Schließen der
Seite bringt Sie hierher zurück.

**Der Baum**, darunter: eine Zeile je Bereich, die Kinder eingerückt, mit einem
Pfeil, um eine Domäne zuzuklappen. Eine Zeile sagt, wie viel darin steckt —
Landschaften und Diagramme über den ganzen Teilbaum bei einer Domäne, Diagramme
bei einer Landschaft — und wann sie sich zuletzt geändert hat. Darunter, wo es
etwas zu sagen gibt, trägt sie ihre **Befunde**: wie viele Namen zwei Bereiche
beide beanspruchen, wie viele Kopien veraltet sind, und den Rest von *Ein Name
in der ganzen Organisation* weiter unten. **Reihenfolge** sortiert nach Name
oder nach dem, was Sie zuletzt geändert haben.

- **Öffnen** betritt einen Bereich, der etwas zeichnet. Ein Bereich, der nichts
  zeichnet, ist eine Domäne: alles, was darunter abgelegt ist, wird aufgelistet,
  und es gibt keine Zeichenfläche zu zeigen.
- **Neuer Bereich…** fragt nach einem Namen und danach, unter welchem Bereich er
  abgelegt wird. Jede Zeile hat einen eigenen, was der schnelle Weg ist, unter
  diesem Bereich etwas hinzuzufügen.
- **Einstellungen…** auf jeder Zeile enthält den Namen, was es ist
  (Organisation, Domäne, Programm, Landschaft — ein Wort für den Bildschirm,
  nichts verhält sich anders), einen Auftraggeber, eine Beschreibung, Links und
  **Abgelegt unter**, was ihn verschiebt.
- **Löschen** entfernt den Bereich und alles, was darunter abgelegt ist: seinen
  Ordner auf dem Desktop, seine Einträge im Browser. Eine anderswo gespeicherte
  Arbeitsdatei bleibt unberührt. Die Organisation selbst kann nicht gelöscht
  werden — sie ist der Ordner, den Sie geöffnet haben.

**Beispiele**, zuletzt. Eines in einen leeren, unbenannten Ordner zu kopieren
macht das Beispiel zu *der* Organisation; es in einen Ordner zu kopieren, der
schon etwas ist, legt es unter einem eigenen neuen Bereich ab. So oder so gehört
es von diesem Moment an Ihnen, und nichts, was Sie tun, wirkt auf das Beispiel
selbst.

Einen Bereich umzubenennen gibt ihm ein neues Label und sonst nichts — wo er
abgelegt ist, ist seine Adresse, und Umbenennen ist kein Verschieben. Einen zu
verschieben ändert die Adresse des Bereichs und von allem darunter und lässt den
Inhalt unberührt: jeder Platzhalter anderswo im Ordner, der hineinzeigte, wird
im selben Schritt an die neue Adresse mitgenommen, sodass ein Verschieben nie
eine Spur veralteter Kopien hinterlässt. Beim Start öffnet die App den Bereich
wieder, den Sie geöffnet hatten.

Sechs Namen werden abgelehnt, weil die eigenen Ordner eines Bereichs sie schon
verwenden: `diagrams`, `docs`, `decisions`, `transitions`, `images` und
`logos`.

## Ein Name in der ganzen Organisation

Ein Name bedeutet überall in Ihrem Ordner dasselbe. Das Lagersystem ist ein
System, welche Domäne es auch zeichnet, und eine Fähigkeit, die die Organisation
benennt, ist diese Fähigkeit, wo immer eine Landschaft sie verfeinert — also wird
jedes Ding **einmal** aufgeschrieben, in einem Bereich, und jeder andere Bereich,
der es verwendet, zeigt auf dasselbe.

**Der Bereich, der es aufschreibt, verantwortet es.** Dieser Datensatz trägt die
Details: in welcher Phase es ist und an welchen Daten, wer es verantwortet,
welcher Anbieter es verkauft, worauf es gebaut ist, seinen Reifegrad. Ändern Sie
davon etwas dort, und überall, wo es gezeichnet wird, steht das Neue.

**Überall sonst steht ein Platzhalter** — eine Karte, die das Ding zeichnet,
ohne es zu verantworten. Ein Platzhalter zeigt seinen Namen mit einer kleinen
Zeile **aus …** darunter, die sagt, wo es wirklich definiert ist, und sein
Inspektor sagt dasselbe mit einer Schaltfläche, um dorthin zu gehen. Sein Name
und diese Zeile sind Kopien, deshalb werden sie schreibgeschützt gezeigt, und
alles in den Details des Eigentümers ebenso; was ein Platzhalter *sehr wohl*
tragen kann, ist **seine eigene Beschreibung** — was das ERP für das Lager
bedeutet, ist eine andere Seite als das, was das ERP ist, und beide sind es wert,
geschrieben zu werden. Ebenso die Farbe, die Form und das Symbol, die Sie ihm
geben, und wo Sie ihn auf Ihren eigenen Boards platzieren.

Welcher Bereich ein Ding verantwortet, entscheidet die **Tiefe**: der tiefste
Bereich, der es aufschreibt. Diese eine Regel funktioniert in beide Richtungen,
und das ist der Punkt. Fähigkeiten werden auf der Organisation geschrieben und
nach unten verfeinert, also behält die Organisation sie. Anwendungen werden in
der Landschaft geschrieben, die sie betreibt, also behält eine Domäne ihre
eigenen — und eine Organisation, die eine Anwendung beim Namen nennt, bevor
jemand sie ausgearbeitet hat, benennt einen Platzhalter, der in dem Moment
beiseitetritt, in dem jemand tiefer den echten Datensatz schreibt.

### Was ein Befund bedeutet

Die App verweigert deswegen nie ein Speichern. Sie liest beim Öffnen den ganzen
Ordner — und wieder, wann immer der Ordner sich unter ihr ändert — und meldet,
was sie findet. Jede Zeile des Baums auf dem Organisationsbildschirm trägt ihre
eigene Zeile.

- **Konflikt** — zwei Bereiche auf derselben Ebene schreiben beide denselben
  Namen auf. Jemand ist mitten in einer Migration, oder zwei Teams haben am
  selben Nachmittag dasselbe Ding benannt. Beide Zeilen sagen es, weil keine von
  beiden die falsche ist. Machen Sie eine zu einem Platzhalter der anderen.
- **Veraltet** — die Kopie des Namens auf einem Platzhalter ist nicht mehr das,
  was der verantwortende Bereich es nennt, oder der Bereich, auf den er zeigt,
  ist umgezogen. **Aktualisieren** schreibt die Kopien in einem Schritt zurück,
  den Sie wie alles andere rückgängig machen können.
- **Undefiniert** — ein Platzhalter für etwas, das nichts im Ordner aufschreibt.
  Die Karte wird gezeichnet und die Zeile behalten; was er braucht, ist
  irgendwo ein Datensatz, auf den er zeigen kann.
- **Eine lose Zeile** — eine Linie, die an etwas endet, das nichts im Ordner
  hält. Behalten und als Stummel gezeichnet, nie von einem Speichern
  weggeworfen.
- **Ein Vorschlag** — eine Fähigkeit, die eine Domäne benannt hat und die kein
  Bereich darüber hat. Kein Fehler: es ist ein Gespräch mit der Ebene darüber.
- **Ohne Eigentümer** — ein System, das als das von jemand anderem markiert ist,
  ohne dass jemand gesagt hat, wessen.

Eines auf der Liste ist **Information und kein Fehler**: ein Datensatz, den kein
Board in seinem eigenen Bereich zeichnet. Ein Ding kann echt, verantwortet und
dokumentiert sein, ohne schon auf irgendjemandes Bild zu stehen, deshalb wird es
getrennt gezählt und nie wie ein Befund eingefärbt.

### Das Register

**Register** auf dem Organisationsbildschirm ist jede Anwendung im ganzen
Ordner, auf einer Seite. Nichts schreibt es: es wird bei jedem Lesen des Ordners
aus den Bereichen selbst gelesen, kann also nicht von dem abweichen, was die
Ordner sagen, und es gibt keine Liste, die zwei Domänen gleichzeitig bearbeiten
könnten.

Jede Zeile sagt, wie die Anwendung heißt, **welcher Bereich sie verantwortet**,
ob sie jemand anderem gehört und wem, **wie viele Bereiche sie zeichnen** (zeigen
Sie auf die Zahl, um ihre Namen zu sehen), und die Befunde dazu als kleine
Chips. Das Filterfeld durchsucht den Namen, den Schlüssel und den Bereich;
**Nach Name** und **Nach Bereich** sind die beiden Reihenfolgen. **Öffnen**
betritt den Bereich, der die Anwendung verantwortet, mit ausgewählter Karte —
dort, wo ihre Details geändert werden können.

Eine Zeile, die sagt, dass zwei Bereiche den Namen beide aufschreiben, bietet
**Verknüpfen…**: es öffnet den Bereich, dessen Datensatz weichen soll, und fragt
dort, weil ein Datensatz nur je von dem Bereich geändert wird, der ihn hält.

### Einen Datensatz zwischen Bereichen verschieben

Wo ein Ding aufgeschrieben ist, ist eine Entscheidung, die Sie nachträglich
ändern können. Wählen Sie die Karte aus und drücken Sie **Verschieben…** im
Inspektor; der Dialog bietet an, welche der vier in Frage kommen.

- **Verknüpfen** — den Datensatz dieses Bereichs aufgeben und für einen
  einstehen, den ein anderer Bereich schon hält. Das ist, was einen Konflikt
  beilegt, und was eine Karte braucht, die gezeichnet wurde, bevor jemand den
  echten Datensatz schrieb. Dieser Bereich behält seine eigene Beschreibung,
  seine Farben und wo die Karte auf seinen Boards sitzt; er gibt die Details
  auf, die der andere Bereich von da an verantwortet.
- **Hochziehen** — den Datensatz in einen Bereich hinaufschieben, unter dem
  dieser abgelegt ist, und hier einen Platzhalter lassen. Was eine in einer
  Landschaft gezeichnete Anwendung braucht, wenn die Domäne darüber diejenige
  sein soll, die sie verantwortet.
- **Abgeben** — das Umgekehrte: ihn in einen Bereich hinunterschieben, der unter
  diesem abgelegt ist.
- **Übergeben** — ihn in einen beliebigen anderen Bereich verschieben. **Hier
  einen Platzhalter lassen** ist standardmäßig angehakt; entfernen Sie den
  Haken, und dieser Bereich zeichnet das Ding gar nicht mehr.

Die letzten drei schreiben **zwei Bereiche**, deshalb fragen sie zuerst. Der
Bereich, in den es geht, wird geschrieben, bevor sich dieser ändert, und das ist
Absicht: geht auf halbem Weg etwas schief, bleibt Ihnen der Datensatz an *beiden*
Stellen — ein Konflikt, den Sie sehen und mit **Verknüpfen** beilegen können —
statt an keiner.

Das ist auch der Grund, warum **Rückgängig dort aufhört**. ⌘Z nimmt alles zurück,
was Sie seither getan haben, und verweigert dann diesen Schritt mit einer Zeile,
die sagt, warum: nur seine Hälfte liegt auf dem Stapel dieses Fensters, und die
andere Hälfte ist eine Datei in einem Bereich, für den hier nichts spricht. Um
ihn zurückzuholen, verschieben Sie den Datensatz erneut in die andere Richtung.

Ein Verschieben wird abgelehnt, mit dem Grund, wenn der Bereich, in den es ginge,
den Namen bereits verantwortet, wenn ein Hochziehen einen Bereich nennt, unter
dem dieser nicht abgelegt ist, und wenn das Entfernen des Datensatzes Dinge, die
darunter abgelegt sind, ohne Halt ließe.

## Ihr Arbeitsordner (Desktop)

Beim ersten Start fragt die Desktop-App nach einem **Ordner zum Arbeiten**, und
alles, was Sie anlegen, lebt dort als Dateien, die Sie lesen können:

```
<Ihr Ordner>/
  scope.json                          die Organisation: ihr Name, Auftraggeber, Links
  acme-logistics/                     ein Bereich darunter
    scope.json                        dieselbe Datei noch einmal, eine Ebene tiefer
    warehouse-landscape/              und noch einmal
      scope.json                      wie er heißt, und was er hält
      model.json                      die Elemente und die Linien dazwischen
      diagrams/landscape.json         was ein Diagramm ist
      diagrams/landscape.geometry.json     wo seine Elemente sitzen
      docs/warehouse.md               die Beschreibung eines Elements, als Prosa
      decisions/0007-one-writer.md    ein Entscheidungseintrag
      logos/own.svg                   ein Logo, das Sie hochgeladen haben
```

Ein Ordner, der eine `scope.json` hält, ist ein Bereich, und die Ordner darin,
die eine halten, sind die Bereiche darunter. Verschieben Sie einen Ordner in
Ihrem Dateimanager, und der Bereich ist an seiner neuen Adresse; nichts darin
sagt, wo er liegt.

**Ein Ordner aus einer älteren Version lässt sich öffnen.** Wenn diese Version
zum ersten Mal einen sieht, wandelt sie den ganzen Baum um — `project.json` und
`group.json` werden zu `scope.json` — und, wo der Ordner ein git-Repository ist,
hält sie zuerst fest, wie der Ordner vorher aussah. Ein zweiter Durchlauf tut
nichts.

Nichts ist in der App versteckt. Legen Sie den Ordner in OneDrive, in Dropbox,
auf eine Netzwerkfreigabe oder in ein git-Repository, und er verhält sich so,
wie alles andere dort. **Ändern…** auf dem Organisationsbildschirm wechselt in
einen anderen Ordner; die Ordner, die Sie vorher verwendet haben, stehen unter
**File ▸ Open Recent Folder**, jeder unter dem Namen, den seine Organisation
sich selbst gibt.

Zwei Dinge folgen daraus, dass Ihre Arbeit Dateien sind.

- **Jemand anderes kann sie ändern.** Ändert sich eine Datei unter Ihnen — der
  Checkout eines Kollegen, ein Sync-Client, Sie selbst auf einem anderen Rechner
  — erscheint ein Streifen über der Zeichenfläche. Ohne ungespeicherte Arbeit
  bietet er an, deren Version zu übernehmen; mit ungespeicherter Arbeit sagt er,
  dass sich beide Seiten geändert haben, und fragt, welche überlebt. Er
  überschreibt deren Version nie ohne zu fragen.
- **Alles wird geschrieben, während es sich ändert.** Drei Sekunden nachdem Sie
  aufgehört haben zu bearbeiten, wenn Sie das Fenster verlassen, und wenn Sie
  es schließen. Nur die Dateien, die sich tatsächlich geändert haben, werden neu
  geschrieben, sodass das Verschieben eines Elements eine kleine Datei neu
  schreibt und sonst nichts.

Auch ein Browser-Tab kann in einem Ordner arbeiten, wo der Browser es anbietet
— aber die Berechtigung überlebt einen Neustart selten, und sie zu erfragen
braucht einen Klick, deshalb nimmt ein Tab einen gemerkten Ordner nur wieder
auf, wenn die Berechtigung noch erteilt ist, und startet sonst ohne ein Wort im
Browser-Speicher. Der Desktop ist derjenige, der wählen muss.

## Verlauf (Desktop)

Wenn der Rechner **git** hat, kann die App einen Verlauf Ihres Ordners führen.
**Speichern… ▸ Momentaufnahme…** bietet eine Nachricht an, die schon aus dem
geschrieben ist, was Sie getan haben — „Lagerverwaltung geändert, 3 Elemente
verschoben“ — und die Sie bearbeiten können, bevor sie festgehalten wird. Die
erste Momentaufnahme fragt, ob überhaupt ein Verlauf geführt werden soll; so
oder so verlässt nichts den Rechner.

**Speichern… ▸ Verlauf…** listet jede Momentaufnahme auf. Eine auszuwählen
zeigt, was sich seither geändert hat — Anwendungen hinzugefügt, entfernt und
geändert, Verbindungen gezogen und gekappt, Entscheidungen getroffen — mit der
Geometrie als Zahl statt als Liste, weil ein Aufräum-Durchlauf ein Satz ist und
vierhundert geänderte Zeilen.

**Der Verlauf eines einzelnen Dings.** Die Auswahl oben auf der Verlaufsseite
grenzt ihn auf ein Diagramm, eine Beschreibung oder eine Entscheidung ein: die
Liste wird zu den Momentaufnahmen, die es berührt haben, und die Änderungen zu
den Zeilen darüber. Dieselbe Seite öffnet sich bereits eingegrenzt über
**Verlauf…** im Reitermenü eines Diagramms, auf der Dokumentationsseite und auf
der Seite einer Entscheidung.

Eine Beschreibung ist das eine Thema, das nicht Sache eines einzigen Bereichs
ist: ein Name bedeutet überall im Ordner dasselbe, also wird die Seite eines
Elements dort geschrieben, wo es definiert ist, *und* überall, wo ein Bereich
es zeichnet und sagt, was es dort bedeutet. Der Verlauf dieses Elements ist die
Vereinigung dieser Seiten, und eine Zeile unter der Auswahl nennt die Bereiche,
die sie liest. Eine wiederherzustellen bleibt Sache dieses Bereichs: es setzt
zurück, was die Seite dieses Bereichs sagte, und die anderen gehören jenen zum
Wiederherstellen.

**Wiederherstellen.** Mit einer gewählten Momentaufnahme macht **Diese Version
wiederherstellen…** das Diagramm, die Beschreibung oder die Entscheidung wieder
zu dem, was es damals war; wenn das ganze Projekt gezeigt wird, tut **Das ganze
Projekt wiederherstellen…** dasselbe für alles. Eine Wiederherstellung ist eine
neue Änderung über allem, was seither geschah, kein Schritt zurück: der Verlauf
wächst weiter, die Aktivitätsliste sagt *Diagramm Lager wiederhergestellt auf
den Stand vom 3. Sep*, ⌘Z macht es rückgängig, und die nächste Momentaufnahme
hält es fest. Die App bietet diese Momentaufnahme an Ort und Stelle an. Eine
Entscheidung, die angenommen, abgelehnt oder abgelöst wurde, bleibt, wie sie ist
— schreiben Sie eine neue, die sie ablöst — und ein wiederhergestelltes Diagramm
lässt Elemente weg, die nicht mehr existieren, und sagt, wie viele.

**Beschriftungen.** **Beschriften…** auf einer gewählten Momentaufnahme gibt ihr
ein eigenes Wort — „Dem Vorstand gezeigt“ — das neben ihrer Nachricht steht, nie
an ihrer Stelle. Eine Beschriftung reist mit dem Verlauf, sodass ein Kollege
dieselbe Markierung an derselben Stelle sieht, in dieser App oder in jedem
git-Client. Zwei Beschriftungen mit demselben Namen in einem Ordner werden
abgelehnt; wählen Sie ein anderes Wort.

Ohne git bietet die App nichts davon an, und alles andere funktioniert wie
gewohnt.

## Der Arbeitsbereich

Ein offenes Projekt: eine Leiste oben, der Editor darunter.

| In der Leiste | Was es tut |
|---|---|
| **Projekte…** | Zurück zum Organisationsbildschirm |
| **Einstellungen…** | Der Name dieses Bereichs und wo er abgelegt ist, und seine Standardwerte: der Autor, der auf einem exportierten Diagramm genannt wird, und die Reifegradspalten, mit denen eine neue Landschaft beginnt. Einen Bereich zu verschieben legt ihn unter einem anderen ab und lässt seinen Inhalt unberührt |
| **Speichern…** | **Arbeitsdatei** (`.lvarch`) ist alles: Geometrie, Gestaltung, Ihre eigenen Logos, fixierte Routen — der Ordner Ihres Bereichs in einer Datei. **Interchange-Dokument** ist nur Topologie und Semantik, die Form für Review und Versionsverwaltung. Auf dem Desktop bietet das Menü auch **Momentaufnahme…** und **Verlauf…** |
| **Öffnen…** | Lädt beides und erkennt am Inhalt der Datei, welches von beiden es ist, nicht am Namen |
| **Aktivität** | Was sich an diesem Projekt seit dem Öffnen geändert hat — eine Liste benannter Schritte mit der Uhrzeit jedes einzelnen. Nur lesend: ⌘Z ist der Weg zurück |
| **Design** | Hell, dunkel oder System. System folgt Ihrem Rechner und wechselt mit ihm |
| **Gespeichert · hh:mm** | Wo das Projekt steht: die Uhrzeit, zu der es zuletzt geschrieben wurde, oder **Ungespeicherte Änderungen**, **Wird gespeichert…**, **Auf der Festplatte geändert**, **Hier und auf der Festplatte geändert** |

Alles wird automatisch gespeichert, während Sie arbeiten: drei Sekunden nachdem
Sie aufhören, beim Verlassen des Fensters und beim Schließen — und Schließen mit
ungespeicherter Arbeit fragt zuerst. In einem Browser ohne Ordner sagt die App
einmal, wenn ihr Speicher zu etwa vier Fünfteln voll ist — das ist die einzige
Warnung, die Sie bekommen, weil ein Browser ohne Nachfrage aufhört zu speichern.
Verweigert der Speicher rundweg (voll, oder in einem privaten Fenster
blockiert), sagt die Leiste unten es einmal, und der Editor arbeitet weiter;
speichern Sie dann eine Arbeitsdatei, denn ohne Speicher ist das Projekt weg,
wenn der Tab geschlossen wird.
Jede Meldung (gespeichert, geladen, fehlgeschlagen) erscheint in dieser unteren
Leiste.

**Sprache.** Die Sprachschaltfläche rechts in der Werkzeugleiste des Editors
(sie zeigt das Kürzel der Sprache, in der Sie sind: NL, FY, DE oder EN) öffnet
ein Menü der vier: Nederlands, Frysk, Deutsch und English. Eine zu wählen
schaltet die ganze Oberfläche um: Menüs, Dialoge, Tooltips, Bandnamen,
Fehlermeldungen und den Titelblock eines PNG-Exports. Beim ersten Mal
entscheidet die Sprache des Browsers. Der Entwurf selbst ändert sich nicht;
Elementnamen sind Inhalt, nicht Oberfläche.

## Zeichnen

**Die Landschaft** hat fünf Bänder: Akteure, Eingabekanäle, externe Systeme, die
Anwendungslandschaft und die Verwaltungsebene. Ziehen Sie ein Element aus der
Palette links in ein Band, oder klicken Sie mit rechts auf die Zeichenfläche und
**Hier hinzufügen**. Bänder ändern ihre Größe, wenn Sie an ihrer Kante ziehen.

**Domänengruppen** rahmen die Anwendungen ein, die zusammengehören. Fügen Sie
eine aus der Palette oder aus dem Menü der Zeichenfläche hinzu, geben Sie ihr
eine Farbe, ziehen Sie Anwendungen hinein, räumen Sie sie für sich auf. Eine
Gruppe zu entfernen lässt ihre Elemente, wo sie sind.

**Container-Diagramme.** Doppelklicken Sie eine Anwendung, um das
Container-Diagramm darunter zu öffnen oder eines anzulegen. Die Anwendung wird
zur Grenze dieses Diagramms, und ihre Komponenten sitzen darin. Die Reiter oben
listen die Landschaft und die Container-Diagramme darunter; klicken Sie mit
rechts auf einen Reiter, um umzubenennen, zu duplizieren, zu löschen oder die
**Diagrammeinstellungen** zu öffnen.

**Dinge finden.** ⌘F / Ctrl+F öffnet den Sucher: Tippen Sie einen Namen, eine
Kategorie, einen Anbieter oder eine Technologie, Enter oder ein Klick wählt das
Element aus, und die Zeichenfläche scrollt dorthin, wobei sie zuerst das
Diagramm wechselt, wenn sie muss. Die Palette hat eine eigene Suche, in beiden
Sprachen.

**Panels.** Ziehen Sie an der Kante zwischen einem Panel und der Zeichenfläche,
um seine Größe zu ändern, doppelklicken Sie die Kante für die Standardbreite,
und verwenden Sie die Pfeile, um ein Panel auf eine Leiste einzuklappen. Die
Schaltfläche für die Übersichtskarte in der Werkzeugleiste zeigt oder verbirgt
die Karte in der Ecke.

**Tastatur.** Tab geht die Elemente auf der Zeichenfläche durch, Enter wählt das
fokussierte aus, und Shift+Enter fügt es der Auswahl hinzu. Die Pfeiltasten
verschieben die Auswahl um einen Rasterschritt, mit Shift um ein Pixel. `?`
zeigt jedes Tastenkürzel.

## Elemente

Sieben Arten: Anwendung, Komponente, externes System, Eingabekanal,
Verwaltungswerkzeug, Akteur, und die Domänengruppe, die sie hält. Wählen Sie
eines aus, und der **Inspektor** rechts zeigt seine Felder in drei Reitern.

- **Allgemein.** Name, Kategorie, Anbieter, Technologie, Lebenszyklus (geplant,
  aktiv, auslaufend, abgeschaltet; als Abzeichen dargestellt, abgeschaltete
  Elemente werden abgeblendet), ob Sie es verwalten, die Beschreibung (siehe
  *Dokumentation*), und wo es sitzt.
- **Darstellung.** Akzentfarbe, Form, Symbol, Symbolgröße.
- **Daten.** Die **Reifegrad-Aspekte** einer Anwendung: für jede Spalte dieses
  Diagramms verwaltet, teilweise, keiner oder gefährdet, mit einer Notiz. Die
  Spalten werden je Diagramm in dessen Einstellungen festgelegt.

**Symbole.** Rund hundert eingebaute Marken, durchsuchbar nach Name, Kategorie
und Stichwort in beiden Sprachen, in zwei Größen: klein in der Kopfzeile, groß
als Auftakt der Karte für ein Diagramm, das aus der Entfernung gelesen wird.
**Ein Logo hochladen** in der Auswahl fügt Ihr eigenes SVG oder PNG hinzu (bis
200 kB). Hochgeladene Logos reisen in der Arbeitsdatei mit, nie im
Interchange-Dokument.

**Mehrere auf einmal.** Wählen Sie mehrere Elemente aus, und der Inspektor
bietet Lebenszyklus, Farbe, Symbol und Domänengruppe für alle, je ein
Rückgängig-Schritt.

**Art ändern.** Klicken Sie mit rechts auf ein Element, **Art ändern ▸**, und
wählen Sie, was es hätte sein sollen; Verbindungen, Beschreibung und Platz
bleiben. Zwei Fälle werden mit dem Grund abgelehnt: eine Anwendung, die ein
Container-Diagramm hat, und eine Komponente, die noch an einer Anwendung hängt.

Elemente gehören zum Modell, nicht zu einem Diagramm: ein Element kann auf
mehreren Diagrammen liegen, und **Aus dem Diagramm entfernen** ist eine andere
Aktion als **Aus dem Modell löschen**. Löschen fragt zuerst und sagt, wie viele
Verbindungen mitgehen.

## Verbindungen

Ziehen Sie vom Anfasser eines Elements zu einem anderen, oder klicken Sie mit
rechts und **Verbindung beginnen zu…**. Eine Verbindung trägt eine Beschriftung,
ein Protokoll (was immer Sie tippen: REST, EDI, Kafka), eine Richtung, die die
Pfeilspitzen setzt, eine Farbe und einen Linienstil. Doppelklicken Sie die
Beschriftung, um sie an Ort und Stelle zu bearbeiten.

Linien werden von einem echten Router um Elemente herumgeführt und neu
geführt, wenn sich etwas bewegt. Wenn automatisch nicht das ist, was Sie wollen:

- Ziehen Sie eine **Pille** in der Mitte eines Segments, um dieses Segment zu
  verschieben, ziehen Sie ein **Quadrat**, um einen Knick zu bewegen; die Route
  wird handgezeichnet, und der Router lässt sie in Ruhe.
- **Hier einen Knickpunkt einfügen**, **Knickpunkt entfernen**, **Zurück zur
  automatischen Route** im Linienmenü.
- **Route fixieren** hält eine Linie genau so, wie sie ist, auch eine ohne
  Knicke.
- **Anheften an ▸** wählt, an welcher Seite eines Elements jedes Ende austritt
  oder ankommt, oder halten Sie Alt gedrückt, während Sie eine Verbindung von
  einem bestimmten Seitenanfasser ziehen. Eine gewählte Seite ist eine
  Randbedingung, die der Router einhält, keine handgezeichnete Route.
- Ziehen Sie die Beschriftung von ihrer Standardposition weg;
  **Beschriftungsposition zurücksetzen** bringt sie zurück.

Auf einem sehr vollen Board — mehr als etwa hundertfünfzig Linien, die um einen
Kanal konkurrieren — lehnt das automatische Routing ab, statt Minuten darauf zu
verwenden, und sagt es in der unteren Leiste. Nichts geht verloren: die Linien
behalten die Routen, die sie hatten, und alles, was Sie von Hand gezeichnet
haben, bleibt genau so, wie Sie es hinterlassen haben.

## Layout

**Aufräumen** lässt ein automatisches Layout über das Diagramm laufen, mit einer
Richtung (quer, abwärts, oder Gruppen quer und ihre Anwendungen abwärts), einer
Dichte und Fixierungen für das, was Sie von Hand platziert haben.
**Verbindungen routen** zeichnet nur die Linien neu und lässt jedes Element, wo
es ist; **Alles neu routen** ignoriert Fixierungen. Eine Domänengruppe kann aus
ihrem Menü für sich aufgeräumt werden.

Aufräumen arbeitet neben der App statt in ihr, sodass das Fenster am Leben
bleibt, während es läuft, und die Aufräumen-Schaltfläche derweil zu
**Abbrechen** wird. Auf einem Diagramm mit mehr als vierhundert Kästen lehnt es
ab und sagt es, statt mehrere Minuten nachzudenken: verteilen Sie das Board auf
mehrere Diagramme, oder räumen Sie eine Domänengruppe nach der anderen auf.

Von Hand: eine Auswahl **ausrichten** und **verteilen** aus der schwebenden
Werkzeugleiste oder dem Auswahlmenü, ein **Raster** mit optionalem Einrasten,
Verschieben mit den Pfeilen, **Einpassen** (Shift+1) und 100 % (Shift+2).

## Dokumentation

Jedes Element hat eine Markdown-Beschreibung, und sie kann eine ganze Seite
sein. Öffnen Sie sie als Seite mit **Dokumentation öffnen** im Menü des
Elements, der Ausklapp-Schaltfläche neben dem Beschreibungsfeld im Inspektor,
Enter auf dem ausgewählten Element, oder einem Doppelklick auf alles, was keine
Anwendung ist.

Die Seite öffnet sich zum **Lesen**: das Dokument mit einem Inhaltsverzeichnis,
die anderen Elemente des Diagramms links zum Wechseln (eine Seitenmarke zeigt,
wer schon Dokumentation hat), und die eigenen Felder des Elements rechts.
**Bearbeiten** setzt den Quelltext nach links und das Ergebnis daneben, und macht
auch die Felder rechts bearbeitbar. ⌘B und ⌘I umschließen die Auswahl; Escape
verlässt zuerst Bearbeiten, dann die Seite. Änderungen werden nach einer kurzen
Pause und beim Verlassen gespeichert, ein Rückgängig-Schritt je Pause.

Eine leere Seite kann **mit der Vorlage beginnen**: eine Kopftabelle und die
üblichen Abschnitte. Die Zeile **Kurzbeschreibung** dieser Tabelle ist das, was
das Element auf der Zeichenfläche zeigt; ohne sie ist es der erste Absatz.
`[[Name]]` im Text wird zu einem Link auf dieses Element. Gewöhnliche Links
öffnen sich außerhalb der App.

**Dokumentation** in der oberen Leiste öffnet die Seite des ausgewählten
Elements, oder des ersten Elements auf dem Diagramm, wenn nichts ausgewählt ist.
Ein eingezäunter Codeblock, der auf einer Seite mit `mermaid` markiert ist, wird
als Diagramm gezeichnet. Ein mit `bpmn` markierter Block wird als Prozess
gezeichnet: BPMN 2.0 XML, wie die gängigen Modellierungswerkzeuge es speichern,
mit einem eigenen Diagrammabschnitt, der sagt, wo alles steht — Pools und
Lanes, Tasks, Ereignisse, Gateways, Flüsse und Nachrichten, schreibgeschützt.
Die Seite eines Prozesselements ist der Ort, wo einer hingehört (seine
`realises`-Zeile sagt, für welche Fähigkeit er das Wie ist), und eine Datei ohne
Diagrammabschnitt wird als Text unter einer Zeile gezeigt, die sagt, warum.

## Entscheidungen

**Entscheidungen** in der oberen Leiste öffnet die Architekturentscheidungen
(Architecture Decision Records): ein Baum links, die Einträge des ausgewählten
Knotens in der Mitte, und der Eintrag, den Sie lesen, rechts.

Die Einträge dieses Bereichs sind **eine Liste**. Ein Eintrag gehört entweder
zum Bereich als Ganzem, oder er handelt von einem Ding darin — einer Anwendung,
einer Fähigkeit, einem Schritt einer Kundenreise — und der Baum hat einen Knoten
für jedes Ding, das Einträge hat, wobei jede Anwendung aufgeführt wird, ob sie
schon welche hat oder nicht. Etwas, das das Modell verlassen hat, behält seine
Einträge unter *Entfernte Anwendungen*.

Darunter kommen die Bereiche **über** diesem, je als ein Abschnitt: *Von Acme
Logistics*, *Von Retail*. Ihre Einträge werden hier gelesen und **dort
geändert, wo sie liegen** — der Leser zeigt sie ohne Bearbeiten-Schaltfläche und
bietet stattdessen an, diesen Bereich zu öffnen. Die Nummerierung ist je
Bereich, sodass ADR-0001 der Domäne und ADR-0001 der Landschaft zwei Einträge
sind und es immer waren.

Ein Eintrag folgt dem MADR-Format: Kontext und Problemstellung,
Entscheidungsfaktoren, die betrachteten Optionen, das Ergebnis und seine
Konsequenzen, die Vor- und Nachteile jeder Option, weitere Informationen. **Neue
Entscheidung** fragt nach dem Titel und beginnt den Text mit dieser Vorlage.
Titel, Status, Datum und Entscheidungsträger sind Felder über dem Text; die
Tabelle **Prüfer und Unterschriften** am Ende listet auf, wem die Entscheidung
vorgelegt wurde, jeweils mit einem Urteil und dem Tag, an dem es gefällt wurde.

Der Status ist ein Arbeitsablauf, kein Label. Ein Eintrag beginnt als
**Vorgeschlagen**, geht **In Prüfung** und wird dann **Angenommen** oder
**Abgelehnt**. Diese beiden sind das Ende des Weges: von dort an kann der
Eintrag nicht mehr bearbeitet oder gelöscht werden, denn eine Entscheidung, die
sich nachträglich umschreiben lässt, ist kein Protokoll einer Entscheidung. Ein
angenommener Eintrag kann später **Abgelöst** werden, was nach dem Eintrag
fragt, der ihn ersetzt, und den Verweis in beide Richtungen zeigt. Eine Prüfung
kann auf Vorgeschlagen zurückgesetzt werden.

Das Suchfeld über der Liste durchsucht jeden Eintrag im Baum auf einmal — Titel,
Text und Prüfer, die dieses Bereichs und die der darüberliegenden. Texte sind
Markdown, mit denselben `[[Name]]`-Links wie die Dokumentation; **Hilfe zur
Formatierung** neben dem Quelltext zeigt die Syntax, Mermaid-Diagramme
eingeschlossen. Änderungen werden mit diesem Bereich gespeichert.

## Zeit, und der Tag, den ein Board zeigt

Jede Anwendung kann neben ihrem Lebenszyklus **Lebenszyklusdaten** tragen: den
Tag, an dem sie live geht, den Tag, an dem sie ausläuft, den Tag, an dem sie
weg ist. Alle drei sind optional, und eine Anwendung ohne eines davon verhält
sich genau wie immer. Wo ein Datum vergangen ist, gewinnt es über den
gespeicherten Lebenszyklus, denn eine Landschaft, die drei Jahre nach dem
Go-live noch „geplant“ sagt, ist eine, die niemand aktualisiert hat.

Eine Verbindung kann ein eigenes **Zeitfenster** tragen, *gültig ab* und *gültig
bis*. Fast keine braucht eines: eine Linie ohne Zeitfenster ist da, solange
beide Dinge, die sie verbindet, da sind. Die Linien, die eines brauchen, sind
die vorübergehenden — ein Sync, eine Routing-Fassade, ein doppeltes Schreiben —
was genau die Hybridphase einer Ablösung ist.

**Zeigt** in der Diagrammleiste sagt, welchen Tag das Board zeichnet. Es liest
sich *Heute*, bis Sie einen Tag nennen, und dann liest es sich als dieser Tag
und hebt sich hervor, sodass ein Board, das 2028 zeigt, nicht wie ein Board
aussieht, das jetzt zeigt. Jede Karte zeichnet die Phase, in der sie an diesem
Tag ist, und eine Linie mit Zeitfenster erscheint nur innerhalb davon. Den Tag
zu ändern ist eine gewöhnliche Bearbeitung: sie ist ein Eintrag in Aktivität,
und ⌘Z nimmt sie zurück.

So entsteht ein zukünftiges Diagramm. Klicken Sie mit rechts auf einen Reiter,
wählen Sie **Duplizieren zum Stand…**, wählen Sie einen Tag, und Sie haben ein
zweites Board derselben Landschaft, wie sie dann stehen wird. Es gibt immer nur
ein Modell, also können die beiden nicht auseinanderdriften. Ein exportiertes
PNG eines datierten Boards nennt den Tag in seinem Titel.

**Ersetzt durch** auf einer Anwendung nennt ihren Nachfolger, und
**Verantwortlicher** sagt, wer für sie einsteht. Der Verantwortliche war früher
eine Zeile in der Dokumentationsvorlage; jetzt ist er ein Feld, damit die
Prüfungen des Fahrplans eine Person nennen können.

## Der Fahrplan

**Fahrplan** in der oberen Leiste öffnet die Landschaft auf einer Zeitachse. Nur
was ein Datum hat, bekommt eine Zeile, sodass eine Landschaft mit viertausend
Anwendungen und neun Daten darin ein Fahrplan aus wenigen Zeilen ist — der Rest
ist auf der Zeichenfläche, wo er hingehört. Jede Zeile ist eine Folge farbiger
Abschnitte: geplant, aktiv, auslaufend, weg. Eine Linie durch jede Zeile
markiert heute, und eine zweite markiert den Tag, den das Board hinter der Seite
zeigt.

Der Schieberegler oben bewegt dieses Board. Ziehen Sie ihn, und die
Zeichenfläche dahinter folgt, sodass das Bild und die Achse nicht uneins darüber
sein können, über welchen Tag gesprochen wird.

### Pläne

Ein **Plan** ist, wie eine Änderung der Landschaft aufgeschrieben wird: ein
Titel, ein Status, das Zeitfenster, über das er läuft, wer ihn verantwortet, die
Anwendungen, die er einführt, abschaltet oder ändert, die Entscheidungen, auf
denen er beruht, seine Meilensteine und ein Text in Markdown. Pläne erscheinen
als Bänder unter den Anwendungen auf der Achse, mit einer Marke je Meilenstein.
Wählen Sie einen aus, und er öffnet sich rechts.

Ein Plan läuft **Entwurf → Vereinbart → Läuft → Abgeschlossen** und kann aus
jedem davon aufgegeben werden. Anders als bei einem Entscheidungseintrag lässt
sich jeder Schritt zurücknehmen, und ein abgeschlossener Plan kann weiter
bearbeitet werden: eine Entscheidung hält einen Moment fest, und ein Plan
beschreibt Arbeit. Was der Plan letzten Monat sagte, steht im Verlauf des
Ordners.

**Verschieben…** verschiebt einen Plan um eine Anzahl Tage — sein Zeitfenster,
jeden Meilenstein und die Lebenszyklusdaten der Anwendungen, die er einführt und
abschaltet — in einem einzigen Schritt, denn ein Plan, der sich verzögert, ist
ein Ereignis.

Jeder Plan ist eine Markdown-Datei in `transitions/` in Ihrem Projektordner,
nummeriert ab `TR-0001` aufwärts.

### Der Business Case

Der Text eines Plans kann einen **Business Case** halten: einen eingezäunten
Block, dessen Eingabe eine lesbare Cashflow-Tabelle ist, mit den darunter
ausgerechneten Zahlen.

````markdown
```business-case
currency: EUR
discount rate: 10%

| Line       | Year 0   | Year 1 | Year 2  |
| ---------- | -------- | ------ | ------- |
| Investment | -415 000 |        |         |
| Savings    |          | 25 000 | 125 000 |
```
````

Eine negative Zahl ist Geld, das hinausgeht, eine positive Geld, das
hereinkommt, und eine leere Zelle ist null. Darunter berechnet die App den
Netto- und den kumulierten Cashflow, den Kapitalwert zum angegebenen Zinssatz,
den internen Zinsfuß, die Amortisation in Perioden, die Kapitalrendite und das
Nutzen-Kosten-Verhältnis. Ihre Tabelle wird nie umgeschrieben.

Eine zweite Tabelle, `Criterion | Weight | Score`, fügt eine gewichtete
Bewertung für den Teil hinzu, der nicht Geld ist — bewertet von eins bis fünf,
aus einem Maximum, das die App ausrechnet, statt einem, das Sie tippen. Alles
darüber hinaus gehört in einen Entscheidungseintrag, mit seinen Faktoren und den
Optionen, die Sie abgewogen haben.

**Business Case hinzufügen** im Bearbeitungsfenster setzt einen leeren Block an
der Cursorposition ein.

### Worin sich die Daten widersprechen

Unter der Achse steht eine Liste von Widersprüchen: eine Anwendung, die
abgeschaltet wird, während Verbindungen noch live sind, ein Nachfolger, der
erst ankommt, nachdem das, was er ersetzt, weg ist, eine Abschaltung, für die
kein Nachfolger benannt ist, eine Verbindung, die noch gültig ist, nachdem eines
ihrer Enden abgeschaltet wurde, und ein Plan über den Tag hinaus, an dem er
fertig sein sollte.

Sie sagt, wo die Daten einander widersprechen. Sie kann Ihnen nicht sagen, dass
eine Landschaft veraltet ist — nichts kann das — und die Seite sagt es unter
der Liste.

## Die Geschäftsarchitektur

**+** in den Diagrammreitern, dann **Geschäftsarchitektur**, legt ein **Blatt**
an: die Ebene über den Anwendungen, auf einer Seite. Eine Landschaft sagt, was
läuft und was mit wem spricht. Ein Blatt sagt, was die Organisation tut, für wen
sie es tut, und wie viel davon irgendeine Software überhaupt abdeckt.

Ein Blatt wird *angeordnet*, nicht gezeichnet. Es gibt nichts zu ziehen und
keinen Router: was es zeigt, sind vier Bäume — eine Kundenreise, die
Verantwortungsbereiche darunter, die Fähigkeiten darin und die Beteiligten am
Rand — und die Seite wird aus deren Reihenfolge und Tiefe berechnet. Es bekommt
einen Reiter neben den Boards, und es zu öffnen lässt die Zeichenfläche, wo sie
war, sodass das Bild, an dem Sie gearbeitet haben, noch da ist, wenn Sie
zurückkommen.

![Das Blatt der Geschäftsarchitektur: die Beteiligten am Rand, die Kundenreise oben mit einer Zeile je Bahn, und die Bereiche mit ihren Fähigkeiten und wie jede abgedeckt ist](screenshot-sheet.png)

### Die Kundenreise, und die Wege durch sie

Oben quer verläuft eine **Kundenreise**: das, was die Organisation tut, von
Anfang bis Ende. Ihre Phasen sind die Spalten, von links nach rechts gelesen,
und unter jeder Phase stehen die Schritte, die darin getan werden.

Eine Kundenreise ist selten ein einziger Weg. Ein Schritt kann eine **Bahn**
nennen — den Beteiligten, dessen eigener Weg es ist — und das Blatt zeichnet
eine Zeile je Bahn unter denselben Phasen, den gemeinsamen Weg zuerst. Wo eine
Bahn abzweigt und wo sie wieder einmündet, ist nirgends aufgeschrieben: es ist
die erste und die letzte Phase, in der die Bahn einen eigenen Schritt hat. Eine
Phase innerhalb dieser Spanne, in der sie keinen hat, wird als *wie die Zeile
darüber* gezeichnet; außerhalb der Spanne wird die Bahn gar nicht gezeichnet.
Nichts kann dem widersprechen, wo ein Weg abgeht und zurückkehrt, denn nichts
außer seinen Schritten sagt es.

Ein Schritt, den jemand außerhalb der Organisation tut — ein Partner, der einen
Auftrag erfüllt — wird als außerhalb erledigt markiert, sodass die Seite sagen
kann, dass eine Phase von niemandem innerhalb abgedeckt wird.

### Bereiche, und was sie abdeckt

Unter der Kundenreise stehen die **Bereiche** der Verantwortung, jeder mit
seinen Gruppen und den Fähigkeiten darin. Gezeichnet wird die Tiefe, und das
Modell kennt die Wörter nicht: ein Eintrag auf oberster Ebene ist ein Bereich,
einer darin eine Gruppe, einer darin eine Fähigkeit.

Jede Fähigkeit sagt, wer sie abdeckt:

- **eine Anwendung**, oder mehrere — die Anwendungen, die sie unterstützen. Eine
  Fähigkeit mit zweien davon, von denen eine ausläuft, ist eine Migration, die
  Sie sehen können.
- **Menschen** — niemandes Software, jemandes Aufgabe. Eine vollständige Antwort
  und keine Lücke: eine Seite, die das als Problem zeichnete, würde Ihnen sagen,
  Software für das zu kaufen, was Sie von Hand tun.
- **noch nichts** — keines von beiden, was die Lücke *ist*, und der Grund, die
  Seite zu zeichnen.

Das wird aus dem Modell gelesen und nicht auf der Karte gehalten: eine
Fähigkeit ist abgedeckt, weil etwas in der Landschaft sie unterstützt.
**Unterstützt von…** im Inspektor ist, wie diese Zeile geschrieben wird, und
Unterstützung kann wie alles andere mit einem Datum ein Zeitfenster tragen,
sodass eine ab März abgedeckte Fähigkeit ab März abgedeckt ist.

Am Ende steht ein Band für das, was **noch keiner Domäne zugeordnet** ist — die
Bereiche, die niemandem gegeben wurden. Es ist ein Befund, kein Fehler: eine
Liste dessen, was die Organisation zu tun gesagt hat und wofür sie noch nicht
gesagt hat, wer es tut.

### Eines anlegen

Ein Blatt in einem Projekt, das nichts über seinen Anwendungen hat, ist leer,
und die leere Seite bietet die zwei Stellen zum Beginnen: **Neue Kundenreise**
und **Neuer Bereich**. Alles andere ist ein **+** dort, wo das Ding hinkäme, und
sie funktionieren alle gleich — was Sie angelegt haben, erscheint, es ist
ausgewählt, und der Cursor steht in seinem Namen, sodass Sie überschreiben, wie
es hieß, und Enter drücken.

- **Neue Kundenreise** legt die Kundenreise und ihre erste Phase, *Beginn*, an
  und richtet dieses Blatt darauf, denn ein Band, das eine Überschrift mit
  nichts darunter ist, ist nicht das, worum Sie gebeten haben.
- **+ Phase**, am Ende der Phasenzeile, setzt eine Spalte ans Ende.
- **+ Schritt**, in jeder Zelle, fügt dieser Phase auf dem Weg dieser Zeile
  einen Schritt hinzu.
- **+ Bahn…**, unter der letzten Zeile, fragt, wessen Weg es ist — einer Ihrer
  Beteiligten, oder ein Name, den Sie tippen, als außerhalb der Organisation
  markiert, wenn er es ist — und bei welcher Phase sie abzweigt, denn eine Bahn
  wird dort gezeichnet, wo ihre Schritte sind, und eine ohne Schritte wird gar
  nicht gezeichnet.
- **+ Bereich**, nach dem letzten Bereich, fügt einen hinzu und zeichnet ihn
  auf diesem Blatt von dem Moment an, in dem er existiert.
- **+ Gruppe** und **+ Fähigkeit** in einem Bereich, und **+ Fähigkeit** in
  einer Gruppe. Eine direkt in einem Bereich angelegte Fähigkeit ist eine Karte
  in der Spalte und wird in dem Moment zur Gruppe, in dem etwas hineingelegt
  wird.
- **+ Beteiligter**, neben einem Eintrag der Leiste, fügt einen darunter hinzu;
  **+ Gruppe**, am Fuß der Leiste, beginnt einen eigenen Zweig.

**Unterstützt von…** und **Erledigt von…** im Inspektor sind, wie eine Fähigkeit
abgedeckt wird: Haken Sie eine Anwendung an, und sie unterstützt diese
Fähigkeit; haken Sie ein Team an, und sie ist dessen. Jeder Haken ist ein
eigener Schritt, und die Zeile unter dem Namen der Fähigkeit ändert sich, während
Sie es tun.

**Löschen**, am Fuß des Inspektors, entfernt, was ausgewählt ist, und jede
Zeile, die darauf endete. Es wird abgelehnt, solange etwas darin steckt, und
sagt, wie viel: nichts kaskadiert, also ist ein Bereich, den Sie löschen, einer,
den Sie zuerst geleert haben.

**Was dieses Blatt zeigt**, die Schalter in der oberen Leiste, betrifft das
Blatt und nicht das Modell — welche Kundenreise oben quer verläuft (ein Projekt
mit zwei Kundenreisen beginnt mit keiner), welche Bereiche gezeichnet werden und
in welcher Reihenfolge, die Reihenfolge der Bahnen, und ob die Leiste überhaupt
da ist.

### Eines bearbeiten

Wählen Sie irgendetwas auf der Seite, und es öffnet sich rechts: sein Name,
seine Beschreibung, worunter es sitzt, wo es unter seinesgleichen steht, wessen
Weg ein Schritt ist, ob ein Beteiligter von außerhalb der Organisation ist, und
der Lebenszyklus, in dem eine Fähigkeit ist — eine Fähigkeit im Aufbau ist in
derselben Phase wie eine Anwendung im Aufbau. Ein Ding unter ein anderes zu
verschieben wird abgelehnt, wenn es das Ding in sich selbst legen würde; die
Ablehnung steht in der Liste, statt darin verborgen zu sein. Das Auge in der
oberen Leiste blendet die Leiste der Beteiligten aus.

Eine Anwendung aus der Abdeckung einer Fähigkeit zu öffnen bringt Sie zu einem
Board, das sie tatsächlich zeichnet, und wechselt das Board, wenn das, auf dem
Sie sind, es nicht tut — und zur eigenen Seite der Anwendung, wenn gar kein
Board sie zeichnet.

### Die Unternehmenskarte

**+** in den Diagrammreitern, dann **Unternehmenskarte**, legt die zweite
angeordnete Ansicht an — oder **Karte** auf der Karte *Geschäftsarchitektur* des
Organisationsbildschirms öffnet die der Wurzel. Es ist dieselbe Ebene, andersherum
gelesen: jede Funktion am Rand, in der Reihenfolge, in der das Blatt sie
zeichnet, und nach Tiefe eingerückt; eine Spalte je Anwendung, die die Zeilen
nennen; eine Marke, wo die eine die andere unterstützt. Auf einem Abschnitt —
einem Bereich, einer Gruppe — ist die Marke hohl und bedeutet *etwas hierunter*:
die Zusammenfassung, sodass der Kopf eines Bereichs sagt, worauf sich der ganze
Bereich stützt, bevor Sie seine Fähigkeiten lesen. Anwendungen, die ein anderer
Bereich hält, werden oben quer unter dem Namen dieses Bereichs gruppiert, denn
die Systeme, die die Fähigkeiten der Organisation unterstützen, sind meist die
einer Landschaft, und eine Spalte, die nicht sagt, wessen sie ist, hat die Hälfte
gesagt.

Zwei Spalten kommen zuletzt. **Menschen** ist markiert, wo jemand zugewiesen ist
— eine Spalte statt einer je Beteiligtem, denn „von Hand erledigt“ ist eine
Antwort. **Abdeckung** ist die Lücke: *ungedeckt* auf einer Fähigkeit, die nichts
und niemand abdeckt, *Menschen* auf einer, die von Hand ohne System erledigt
wird, und auf einem Abschnitt, wie viele der Fähigkeiten darunter ungedeckt sind.
Die obere Leiste zählt die drei zusammen. Eine Karte mit einem *Stand*-Tag zählt
die Zeilen, die an diesem Tag live sind, sodass ein System, das ab März etwas
unterstützt, auf der Karte vom Februar eine Lücke ist.

Wählen Sie eine Zeile, und sie öffnet sich rechts, wie auf dem Blatt —
*Unterstützt von…* eingeschlossen, sodass eine Lücke von der Seite aus
geschlossen werden kann, die sie zeigt. Wählen Sie eine Spaltenüberschrift, um
die Anwendung zu öffnen, wo dieser Bereich sie hält.

## Suchen

**Suchen** in der oberen Leiste, oder ⌘K, durchsucht das ganze Projekt auf
einmal: Elemente nach Name, Kategorie, Anbieter und Technologie; Dokumentation
nach dem, was darin geschrieben steht; und Entscheidungen auf allen drei
Ebenen, die der Gruppe eingeschlossen. Ein Element zu wählen wählt es aus und
schwenkt dorthin, ein Dokumentationstreffer öffnet die Seite dieses Elements,
und eine Entscheidung öffnet ihren Eintrag. ⌘F im Editor bleibt der schnelle
Sucher, wenn alles, was Sie wollen, ein Kasten auf der Zeichenfläche ist.

## Diagrammeinstellungen

Klicken Sie mit rechts auf einen Diagrammreiter, **Diagrammeinstellungen…**.

- **Auf der Zeichnung.** Autor, Kunde und Datum für den Titelblock eines
  PNG-Exports, die leer gelassen jeweils auf den Standardwert des Projekts oder
  den Tag des Exports zurückfallen, und ob der Titelblock überhaupt gezeichnet
  wird.
- **Reifegradspalten.** Die Aspektspalten, die Anwendungen auf diesem Diagramm
  tragen: eine Standardspalte hinzufügen (Plattform, CI/CD, DR, Sicherheit,
  Monitoring, Backup, Compliance, Kosten), eine eigene hinzufügen, umbenennen,
  umsortieren oder die Abzeichen ganz ausschalten. Eine Spalte umzubenennen
  behält jeden Status, der schon dagegen erfasst ist.

## Speichern, Exportieren, Weitergeben

Drei Wege hinaus, für drei Zwecke.

- **Die Arbeitsdatei** (`.lvarch`) ist alles und ist das, was Sie jemandem
  geben, der weiterbearbeiten wird. Sie ist Ihr Projektordner in einer Datei —
  ein Zip — sodass jeder sie entpacken und lesen kann, was darin ist, ohne
  dieses Werkzeug. Arbeitsdateien aus früheren Versionen lassen sich weiterhin
  öffnen.
- **Das Interchange-Dokument** trägt Topologie und Semantik und keine Geometrie
  oder Gestaltung: ein Diff davon zeigt, was sich an der Architektur geändert
  hat, nicht, was sich auf der Zeichenfläche bewegt hat. Ein eingebautes Symbol
  reist als `iconType` mit; ein hochgeladenes Logo nicht. Was dieses Werkzeug in
  einem Dokument nicht versteht, überlebt einen Rundgang unberührt, und ein
  Dokument, das keine Symbole verwendet, kommt wortwörtlich zurück.
- **PNG-Export** (die Download-Schaltfläche) öffnet einen Dialog mit einer
  Vorschau des Bildes, wie es hinausgeht: im hellen oder im dunklen Design,
  unabhängig von dem auf dem Bildschirm, mit der Beschriftung jeder Linie oder
  nur den nackten Linien, mit oder ohne den Titelblock am unteren Rand — Kunde,
  Autor und Datum — und mit oder ohne die Legende darunter, die sagt, was die
  Abzeichen- und Lebenszyklusfarben bedeuten. Der Export eines
  Container-Diagramms trägt seine C4-Ecke im Streifen: die Ebene, die
  Anwendung, einen Satz und das Datum. Lebenszyklus-Abzeichen lassen sich für
  ein sauberes Bild vorher ausschalten. Konnte ein Logo nicht eingebettet
  werden, sagt die untere Leiste, welches. Ein sehr großes Board hat Dutzende
  Megapixel und braucht eine Weile zum Zeichnen, deshalb sagt der Dialog, wie
  groß das Bild wird, und seine Schaltfläche fragt, bevor sie beginnt.

## Einstellungen

Raster, Einrasten, Lebenszyklus-Abzeichen, eingeklappte Panels und ihre Breiten,
die Übersichtskarte, die Aufräum-Einstellungen, die Sprache und das Design
werden je Browser oder je Desktop-Installation gemerkt. Sie gehören Ihnen, nicht
dem Projekt: sie reisen in keiner Datei mit.

## Rückgängig

**⌘Z** deckt alles ab, in der Reihenfolge, in der Sie es getan haben: einen
verschobenen Kasten, ein umbenanntes Diagramm, eine angenommene Entscheidung,
eine geleerte Projekteinstellung. Einen Namen zu tippen ist ein Schritt statt
einer je Buchstabe, und ein Ziehen und die Linien, die sich danach neu führen,
sind ein Schritt — sodass einmal zurückgehen Ihnen gibt, was Sie hatten, und
nicht das, was Sie einen Tastendruck vorher hatten.

**Aktivität** in der oberen Leiste listet diese Schritte mit ihren Namen und
Zeiten auf. Es ist ein Protokoll, kein Weg zurück: zu einem Eintrag zu springen
würde eine Frage aufwerfen („und alles danach?“), die ⌘Z bereits beantwortet.

## Tastenkürzel, die man kennen sollte

| Tasten | Tut |
|---|---|
| `?` | Jedes Tastenkürzel |
| ⌘F / Ctrl+F | Ein Element suchen |
| Enter | Die Dokumentation des ausgewählten Elements öffnen |
| F2 | Die Auswahl umbenennen |
| Delete | Die Auswahl entfernen, nach Rückfrage |
| ⌘Z, ⌘⇧Z | Rückgängig, Wiederholen — ein Stapel über alles |
| ⌘C ⌘X ⌘V, ⌘D | Kopieren, Ausschneiden, Einfügen, Duplizieren |
| Pfeile, ⇧Pfeile | Um einen Rasterschritt verschieben, um ein Pixel |
| Shift+1, Shift+2, `=`, `-` | Einpassen, 100 %, Vergrößern, Verkleinern |
| Shift+F10 | Das Menü für die Auswahl |
| ⌘S / Ctrl+S | Jetzt speichern |

Unter Windows und Linux lesen Sie Ctrl für ⌘.
