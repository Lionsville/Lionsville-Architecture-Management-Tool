// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ChapterText } from '../../types'

/** Each chapter's title, what it is about, its worked example and what its picture shows. */
export const CHAPTERS: Readonly<Record<string, ChapterText>> = {
  start: {
    title: 'The first page',
    intro: 'The first page offers three ways in: start your own organisation, look around the example, or carry on with work you already have.',
    picture: 'The first page: a name to start with, the example to look around, and the ways to open work you have.',
    worked: {
      title: 'Look around before you start',
      steps: [
        'On the first page, press **Open the example**. A band on every screen says you are visiting it.',
        'Open **Application landscape** under Views here, move a card and rename it: try anything.',
        'Press **Leave the example** in the band. Nothing you tried is kept.',
        'Type the name of your own organisation, such as *Acme Logistics*, and press **Start**.',
      ],
    },
  },
  frame: {
    title: 'Finding your way',
    intro: 'Two rows stand over every screen: row one says where you are and whether your work is safe, row two lists the places in the scope you are in. The tree of scopes is beside every home.',
    picture: 'The frame: row one with Back and Forward, the trail, Find, undo and the status word; row two with Home and the places; the tree of scopes on the left and a scope’s home beside it.',
    worked: {
      title: 'Go from the organisation to a board and back',
      steps: [
        'On the organisation’s home, press **Warehouse** in the tree on the left.',
        'Under **Views here**, press **Application landscape**: the board opens, and row two shows its tab.',
        'Press **Acme Logistics** in the trail in row one to go to the organisation’s home.',
        'Press **‹** (or {key:Cmd+[|Alt+Left} on the desktop) to go back to the board, exactly as you left it.',
        'Press {key:Mod+K}, type *roadmap* and press {key:Enter} to open the roadmap from anywhere.',
      ],
    },
  },
  work: {
    title: 'Your work, files and settings',
    intro: 'Your work is kept as you go, in a folder or in this browser. The status word in row one says where and whether it is safe; from there, and from the menus, you open, copy, share and look back.',
    picture: 'Your work: the status word in row one, pressed to open the panel that says where the work is kept and what can move it.',
    worked: {
      title: 'Take your organisation to another computer',
      steps: [
        'Press the status word in row one to open **Your work**.',
        'Press **Save a copy…** and give it a password, twice.',
        'Carry the `.lvarch` file to the other computer, open the app there and choose **Open a file…**.',
        'Type the password and choose where it lands: a new folder, or over what is open there.',
      ],
    },
  },
  board: {
    title: 'Landscape boards and container diagrams',
    intro: 'A landscape board draws the applications in bands, with the lines between them; a container diagram opens under one application and draws what it is made of. The model is one, and a board is a view of it.',
    picture: 'A landscape board: the bands, application cards with their status, a line with its label, and the panel of the card that is selected.',
    worked: {
      title: 'Draw a new application and connect it',
      steps: [
        'Open **Application landscape** and double-press an empty place in the application band.',
        'Type *Route Optimiser* and press {key:Enter}: the card is drawn and selected.',
        'Point at the card and drag from the dot at its edge to **Order Management**.',
        'In the panel, give the line the label *routes* and the protocol *REST*.',
        'Press {key:Mod+Z} if it was not what you meant: the line goes, then the card.',
      ],
    },
  },
  panel: {
    title: 'The panel and the record page',
    intro: 'Whatever is selected is read and changed in the panel beside the work. Its record page shows the same rows with every field, the text written about it and everything it is connected to.',
    picture: 'The panel: the name, one line of facts, tabs, rows of label and value, and the text’s first lines.',
    worked: {
      title: 'Write down who owns an application',
      steps: [
        'Select **Warehouse Management** on the board.',
        'In the panel, press **+ Owner, vendor…** and choose **Owner**.',
        'Pick **Warehouse team** from the units, or type a name.',
        'Press **Record ›** beside the name to read the whole record, with its text and lines.',
      ],
    },
  },
  technology: {
    title: 'The technology landscape',
    intro: 'What the applications stand on: the services a platform team offers and the platforms that deliver them, in three columns that read left to right. Nothing is drawn by hand; every row and line is read from the records.',
    picture: 'The technology landscape: applications, services and platforms in three columns, with the lines of the row that is picked.',
    worked: {
      title: 'Find out who stands on a platform',
      steps: [
        'Open the **Technology landscape** view of the organisation.',
        'Press **OpenShift** in the platforms column: its lines are drawn and the reader opens.',
        'Read the number on its row: every application standing on it or on anything under it.',
        'Press **If it went…** for the platform’s report: what would be left standing.',
      ],
    },
  },
  sheet: {
    title: 'The business sheet and the enterprise map',
    intro: 'A sheet says what the organisation does, who it does it for and how much of it any software covers: a journey across the top, the areas and their capabilities under it, the stakeholders down the side. The enterprise map reads the same layer as a table of functions against applications.',
    picture: 'A business sheet: the journey’s phases across the top, the areas with their capabilities, each saying what covers it.',
    worked: {
      title: 'Say which application covers a capability',
      steps: [
        'Open the **Business architecture** sheet of the organisation.',
        'Select the capability **Invoicing**.',
        'In the panel, under **Supported by**, tick **Billing**.',
        'The capability now reads as covered by a system, and the map’s counts follow.',
      ],
    },
  },
  poster: {
    title: 'The poster',
    intro: 'The poster draws a sheet as one page of fixed size: every area a block, every capability a tile. Read it at any distance; in Design, place the blocks by hand and drag teams and applications onto the tiles.',
    picture: 'The poster: the journey across the top, areas as blocks with capability tiles, and the Read and Design switch.',
    worked: {
      title: 'Put a team on a capability, on the poster',
      steps: [
        'Open the sheet and choose **Poster**, then **Design**.',
        'Open the tray and find **Warehouse team**.',
        'Drag it onto the tile **Slotting and replenishment**: the team is now responsible for it.',
        'Choose **Read** again; the label stays on the tile.',
      ],
    },
  },
  chart: {
    title: 'The organisation chart and the Conway map',
    intro: 'The organisation chart is laid out from the units and the people in their roles, on a day; the Conway map asks whether the teams and the systems they own line up.',
    picture: 'The organisation chart: units in boxes with their roles and holders, a vacant role, and the outline beside it.',
    worked: {
      title: 'Fill a vacant role',
      steps: [
        'Open the **Organisation chart** view.',
        'Find **Warehouse team** in the outline and press it.',
        'Press **vacant** beside the role nobody holds.',
        'Pick the person, their share and the first day, and press **Assign**.',
      ],
    },
  },
  drawing: {
    title: 'Drawings',
    intro: 'A drawing is the one view you draw and the model does not. Its shapes can point at elements, so the picture stays tied to what it shows.',
    picture: 'A drawing: its bar, the picture with the shapes that point at elements outlined, and how many links it has.',
    worked: {
      title: 'Draw a sketch of a warehouse flow',
      steps: [
        'Press **+** in row two and choose **Drawing** under *You draw this one*.',
        'Name it *Dock flow* and choose **Warehouse Management** as what it is about.',
        'Press **Edit drawing**, drag **Warehouse Management** from the palette onto the page and draw around it.',
        'Press **Save** and **Done**: the shape is outlined on the picture and opens its element.',
      ],
    },
  },
  decisions: {
    title: 'Decisions, history and another day',
    intro: 'Decision records say what was decided and why, in a workflow that ends in a record nobody can rewrite. The history keeps snapshots of the work; a board can be looked at on another day without changing anything.',
    picture: 'Decisions: the list under Still open, In force and Ended, and a record with where it stands on a line at the top.',
    worked: {
      title: 'Record a decision and accept it',
      steps: [
        'Open **Decisions** in row two and press **New decision**.',
        'Give it the title *One writer per scope* and say what it is about.',
        'Write the context and the options in **Edit**, and press **Save**.',
        'Send it for review, and when the reviewers have signed, press **Accept**.',
      ],
    },
  },
  observations: {
    title: 'Observations, causes and solutions',
    intro: 'What the team saw, why it happens and what is done about it: observations are analysed into causes and root causes, and a solution earns its way from an idea to something built, tested by experiments and checked against the sightings.',
    picture: 'The analysis: observations on the left, their causes and root causes to the right, and the solutions that address them last.',
    worked: {
      title: 'From a sighting to its root cause',
      steps: [
        'Open **Observations** and press **New observation**.',
        'Write *Pickers wait for replenishment* with where, who saw it and when, and record it.',
        'Press **Cause** on its reader and write *Slotting runs once a night*.',
        'On that cause, press **Make root cause**, then **Solution** to propose what to do about it.',
      ],
    },
  },
  roadmap: {
    title: 'The roadmap and plans',
    intro: 'The roadmap lays the landscape on a time axis: everything with a date gets a row. A plan writes down a change to the landscape, with its window, its milestones and what it introduces and retires.',
    picture: 'The roadmap: the ruler with today marked, plans as bands with milestones, and applications as runs of phases.',
    worked: {
      title: 'Plan the retirement of an application',
      steps: [
        'Open **Roadmap** and press **New plan**.',
        'Name it *Retire legacy rating*, with a window from March to June.',
        'Under what it changes, add **Rating (legacy)** as retired and **Tariff Engine** as introduced.',
        'Read **Where the dates disagree** under the axis: a line still live after its end is said there.',
      ],
    },
  },
  registers: {
    title: 'Registers and checks',
    intro: 'The register lists every application, service and platform in the organisation, read from the scopes themselves. The Checks page lists what the organisation contradicts about itself, by weight, with how to fix each.',
    picture: 'The register: one row per application with the scope that answers for it and its findings, and the checks counted by weight.',
    worked: {
      title: 'Settle a name two scopes both define',
      steps: [
        'Open **Checks** from the organisation’s home and pick the check about a name defined twice.',
        'Read **Why it matters** and **How to fix it**.',
        'Press the finding to open the record in the scope that should give way.',
        'Choose **Link…**: that scope now stands in for the other’s record, and the finding goes.',
      ],
    },
  },
  operating: {
    title: 'The operating model and RACI',
    intro: 'The organisation’s own design of how it is organised: the kinds of unit it has, the roles each holds and what each role is responsible for. It is kept at the organisation, and every change is a step.',
    picture: 'Responsibilities: the groups on the left, and a grid of roles against responsibilities with R, A, C and I.',
    worked: {
      title: 'Start from a library',
      steps: [
        'Open **Operating model** from the organisation’s home and press **Start from a library**.',
        'Pick **Team Topologies** and tick the unit types you want.',
        'Under **What will come in**, rename *Stream-aligned team* to the word you use.',
        'Press **Bring in**: one step, which {key:Mod+Z} takes back.',
      ],
    },
  },
  people: {
    title: 'People',
    intro: 'The organisation’s register of people: one entry per person, kept outside the history so that a name can be forgotten. Every screen asks the register for a name when it draws one.',
    picture: 'People: one line per person with their kind and the roles they hold today.',
    worked: {
      title: 'Add a colleague without a duplicate',
      steps: [
        'Open **People** and press **Add person**.',
        'Type *Pia Schulz* and her work address.',
        'If the register already holds *Pia Schultz*, it says so: press **Use this one**, or **Add anyway**.',
        'Press **This is me** on your own entry, so the app marks you wherever you appear.',
      ],
    },
  },
  guidance: {
    title: 'Principles, topics and building blocks',
    intro: 'What should guide the work: principles that hold in a scope and below it, topics that run across the organisation, and building blocks that many solutions reuse, each evaluated where it is used.',
    picture: 'Guidance: one entry with a tab each for principles, topics and building blocks, a list of one line per item.',
    worked: {
      title: 'Write a principle and cite it',
      steps: [
        'Open **Guidance** and, on **Principles**, press **New principle**.',
        'Write *Buy before build*, flexible, and accept it.',
        'Open a decision and, under **Principles**, say it follows *Buy before build*.',
      ],
    },
  },
  agent: {
    title: 'Working with an agent',
    intro: 'A coding agent connected to the desktop app reads the organisation, moves the app as you would and makes changes you see and can undo. While it works, a band says so, with Stop.',
    picture: 'An agent at work: the band naming the agent and what it is doing, with Stop, and its changes in Activity.',
    worked: {
      title: 'Let an agent tidy a board while you watch',
      steps: [
        'On the desktop, choose **Connect an agent…** and copy the settings into your agent.',
        'Ask it to open *Application landscape* and tidy it.',
        'Watch the band at the bottom; press **Stop** if it goes somewhere you did not mean.',
        'Read its steps in **Activity**, and press {key:Mod+Z} to take back what you do not want.',
      ],
    },
  },
}
