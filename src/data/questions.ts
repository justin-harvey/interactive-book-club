// Seed question bank — three MCQs per Elemental (spec §4 angle taxonomy).
// Shape matches the documented import format (spec §7) so these rows map 1:1 to
// Firestore `questions/{questionId}` documents once Firebase is wired.

export interface Question {
    elementId: string;
    angle: string;          // see spec §3 angle taxonomy: protons, ion, valence, ...
    prompt: string;
    choices: string[];      // exactly 4
    correctIndex: number;   // 0..3
    quarterTheme?: string;
}

export const QUESTIONS: Question[] = [
    // --- Hydrohop — Hydrogen (H) ---
    { elementId: 'hydrogen', angle: 'protons',  prompt: 'How many protons does hydrogen have?', choices: ['0', '1', '2', '3'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'hydrogen', angle: 'ion',      prompt: 'What is the charge of a common hydrogen ion (H⁺)?', choices: ['−1', '0', '+1', '+2'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'hydrogen', angle: 'valence',  prompt: 'How many valence electrons does hydrogen have?', choices: ['0', '1', '2', '8'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Heliofloat — Helium (He) ---
    { elementId: 'helium', angle: 'protons',  prompt: "Helium's atomic number is 2. How many protons does it have?", choices: ['1', '2', '4', '8'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'helium', angle: 'neutrons', prompt: 'The most common isotope is helium-4. How many neutrons does it have?', choices: ['0', '2', '4', '6'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'helium', angle: 'config',   prompt: 'Which best explains why helium rarely forms ions?', choices: ['It has too many electrons', 'Its outer shell is full', 'It is a metal', 'It has no protons'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Carbocrunch — Carbon (C) ---
    { elementId: 'carbon', angle: 'protons',  prompt: 'How many protons does carbon have?', choices: ['4', '6', '8', '12'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'carbon', angle: 'neutrons', prompt: 'Carbon-12 has 6 protons. How many neutrons does it have?', choices: ['6', '12', '0', '18'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'carbon', angle: 'valence',  prompt: 'Carbon has 4 valence electrons. How many covalent bonds does it typically form?', choices: ['1', '2', '4', '6'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Nitronoodle — Nitrogen (N) ---
    { elementId: 'nitrogen', angle: 'symbol',    prompt: "What is nitrogen's chemical symbol?", choices: ['Ni', 'N', 'Ne', 'Na'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'nitrogen', angle: 'ion',       prompt: 'Nitrogen commonly forms an ion with what charge?', choices: ['+3', '−3', '−1', '+5'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'nitrogen', angle: 'electrons', prompt: 'A neutral nitrogen atom has how many electrons?', choices: ['3', '5', '7', '14'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Oxypuff — Oxygen (O) ---
    { elementId: 'oxygen', angle: 'protons', prompt: "Oxygen's atomic number is 8. How many protons does it have?", choices: ['2', '6', '8', '16'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'oxygen', angle: 'ion',     prompt: 'What is the charge of the common oxide ion?', choices: ['+2', '−1', '−2', '+6'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'oxygen', angle: 'valence', prompt: 'How many valence electrons does oxygen have?', choices: ['2', '6', '8', '16'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Sodazoom — Sodium (Na) ---
    { elementId: 'sodium', angle: 'symbol',   prompt: "What is sodium's chemical symbol?", choices: ['So', 'Na', 'S', 'Sd'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'sodium', angle: 'neutrons', prompt: 'Sodium-23 has 11 protons. How many neutrons does it have?', choices: ['11', '12', '22', '23'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'sodium', angle: 'ion',      prompt: 'Sodium tends to lose one electron. What ion does it form?', choices: ['Na⁻', 'Na⁺', 'Na²⁺', 'Na (no charge)'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Chlorofizz — Chlorine (Cl) --- (revived 2026-10-01 for the jungle 3p lesson)
    { elementId: 'chlorine', angle: 'protons', prompt: 'How many protons does chlorine have?', choices: ['7', '17', '18', '35'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'chlorine', angle: 'ion',     prompt: 'Chlorine gains one electron to form which ion?', choices: ['Cl⁺', 'Cl⁻', 'Cl²⁻', 'Cl (no charge)'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'chlorine', angle: 'mass',    prompt: "Chlorine's atomic mass is about 35.45. Why isn't it a whole number?", choices: ['A rounding error', "It's a weighted average of its isotopes", 'Electrons add mass', 'It has partial protons'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Magflash — Magnesium (Mg) ---
    { elementId: 'magnesium', angle: 'protons', prompt: "Magnesium's atomic number is 12. How many protons does it have?", choices: ['2', '10', '12', '24'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'magnesium', angle: 'ion',     prompt: 'Magnesium loses 2 electrons. Which ion does it form?', choices: ['Mg⁻', 'Mg⁺', 'Mg²⁺', 'Mg²⁻'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'magnesium', angle: 'valence', prompt: 'How many valence electrons does magnesium have?', choices: ['1', '2', '6', '8'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Ironclank — Iron (Fe) ---
    { elementId: 'iron', angle: 'symbol',  prompt: "What is iron's chemical symbol?", choices: ['Ir', 'In', 'Fe', 'I'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'iron', angle: 'protons', prompt: 'How many protons does iron have?', choices: ['8', '16', '26', '56'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'iron', angle: 'ion',     prompt: 'Iron commonly forms ions with which two charges?', choices: ['−2 and −3', '+2 and +3', '+1 only', '−1 only'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Neonglow — Neon (Ne) ---
    { elementId: 'neon', angle: 'protons', prompt: "Neon's atomic number is 10. How many protons does it have?", choices: ['2', '8', '10', '20'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'neon', angle: 'symbol',  prompt: "What is neon's chemical symbol?", choices: ['N', 'Ne', 'Na', 'No'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'neon', angle: 'config',  prompt: 'Why is neon a noble gas that rarely reacts?', choices: ['It has 1 valence electron', 'Its outer shell is full', 'It is a metal', 'It has no electrons'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Glowbun — Uranium (U) ---
    { elementId: 'uranium', angle: 'protons',  prompt: 'How many protons does uranium have?', choices: ['46', '92', '146', '238'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'uranium', angle: 'neutrons', prompt: 'Uranium-238 has 92 protons. How many neutrons does it have?', choices: ['92', '146', '238', '330'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'uranium', angle: 'symbol',   prompt: "What is uranium's chemical symbol?", choices: ['Ur', 'U', 'Un', 'Ux'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Beryllia — Beryllium (Be) ---
    { elementId: 'beryllium', angle: 'protons', prompt: "Beryllium's atomic number is 4. How many protons does it have?", choices: ['2', '4', '8', '9'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'beryllium', angle: 'valence', prompt: 'How many valence electrons does beryllium have?', choices: ['1', '2', '4', '8'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'beryllium', angle: 'ion',     prompt: 'Beryllium loses 2 electrons. Which ion does it form?', choices: ['Be⁻', 'Be⁺', 'Be²⁺', 'Be²⁻'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Borolith — Boron (B) ---
    { elementId: 'boron', angle: 'symbol',  prompt: "What is boron's chemical symbol?", choices: ['Br', 'Bo', 'B', 'Be'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'boron', angle: 'protons', prompt: 'How many protons does boron have?', choices: ['3', '5', '10', '11'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'boron', angle: 'valence', prompt: 'How many valence electrons does boron have?', choices: ['2', '3', '5', '8'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Fluorvex — Fluorine (F) ---
    { elementId: 'fluorine', angle: 'symbol',  prompt: "What is fluorine's chemical symbol?", choices: ['Fl', 'F', 'Fe', 'Fr'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'fluorine', angle: 'ion',     prompt: 'Fluorine gains one electron to form which ion?', choices: ['F⁺', 'F⁻', 'F²⁻', 'F (no charge)'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'fluorine', angle: 'valence', prompt: 'How many valence electrons does fluorine have?', choices: ['1', '5', '7', '8'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Aluminio — Aluminum (Al) ---
    { elementId: 'aluminum', angle: 'protons', prompt: "Aluminum's atomic number is 13. How many protons does it have?", choices: ['3', '13', '14', '27'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'aluminum', angle: 'ion',     prompt: 'Aluminum loses 3 electrons. Which ion does it form?', choices: ['Al⁻', 'Al³⁻', 'Al³⁺', 'Al⁺'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'aluminum', angle: 'valence', prompt: 'How many valence electrons does aluminum have?', choices: ['1', '2', '3', '8'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Brimora — Sulfur (S) ---
    { elementId: 'sulfur', angle: 'protons',  prompt: "Sulfur's atomic number is 16. How many protons does it have?", choices: ['6', '8', '16', '32'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'sulfur', angle: 'ion',      prompt: 'Sulfur gains 2 electrons to form the sulfide ion. What is its charge?', choices: ['+2', '−1', '−2', '+6'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'sulfur', angle: 'valence',  prompt: 'How many valence electrons does sulfur have?', choices: ['2', '4', '6', '8'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Scandion — Scandium (Sc) ---
    { elementId: 'scandium', angle: 'symbol',  prompt: "What is scandium's chemical symbol?", choices: ['S', 'Sc', 'Sd', 'Sn'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'scandium', angle: 'protons', prompt: "Scandium's atomic number is 21. How many protons does it have?", choices: ['11', '20', '21', '45'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'scandium', angle: 'ion',     prompt: 'Scandium commonly forms an ion with what charge?', choices: ['+1', '+2', '+3', '−3'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Flame-test Elementals (desert Lesson Three). Each has a 'flame' angle that
    //     teaches its signature flame-test colour (the colours the beacon puzzle uses). ---
    // --- Kaliflare — Potassium (K) ---
    { elementId: 'potassium', angle: 'symbol', prompt: "Potassium's symbol comes from 'kalium'. What is it?", choices: ['P', 'Po', 'K', 'Pt'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'potassium', angle: 'ion',    prompt: 'Potassium (group 1) loses one electron to form which ion?', choices: ['K⁻', 'K⁺', 'K²⁺', 'K (no charge)'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'potassium', angle: 'flame',  prompt: 'What colour does potassium burn in a flame test?', choices: ['Golden yellow', 'Lilac', 'Green', 'Blue'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Cupragleam — Copper (Cu) ---
    { elementId: 'copper', angle: 'symbol',  prompt: "Copper's symbol comes from 'cuprum'. What is it?", choices: ['Co', 'Cu', 'Cp', 'C'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'copper', angle: 'protons', prompt: "Copper's atomic number is 29. How many protons does it have?", choices: ['19', '27', '29', '64'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'copper', angle: 'flame',   prompt: 'What colour does copper burn in a flame test?', choices: ['Green', 'Yellow', 'Lilac', 'Crimson'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Bariglow — Barium (Ba) ---
    { elementId: 'barium', angle: 'symbol', prompt: "What is barium's chemical symbol?", choices: ['Ba', 'B', 'Br', 'Bi'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'barium', angle: 'ion',    prompt: 'Barium (group 2) loses two electrons to form which ion?', choices: ['Ba⁻', 'Ba⁺', 'Ba²⁺', 'Ba²⁻'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'barium', angle: 'flame',  prompt: 'Barium burns what colour in a flame test (close to copper)?', choices: ['Green', 'Blue', 'Yellow', 'White'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Lithflare — Lithium (Li) ---
    { elementId: 'lithium', angle: 'protons', prompt: "Lithium's atomic number is 3. How many protons does it have?", choices: ['1', '2', '3', '7'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'lithium', angle: 'ion',     prompt: 'Lithium (group 1) loses one electron to form which ion?', choices: ['Li⁻', 'Li⁺', 'Li²⁺', 'Li (no charge)'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'lithium', angle: 'flame',   prompt: 'Lithium burns what colour in a flame test?', choices: ['Crimson red', 'Green', 'Blue', 'Yellow'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Stronflare — Strontium (Sr) ---
    { elementId: 'strontium', angle: 'symbol', prompt: "What is strontium's chemical symbol?", choices: ['St', 'Sr', 'Sn', 'Sc'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'strontium', angle: 'ion',    prompt: 'Strontium (group 2) loses two electrons to form which ion?', choices: ['Sr⁺', 'Sr²⁺', 'Sr⁻', 'Sr²⁻'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'strontium', angle: 'flame',  prompt: 'Strontium burns what colour (the red of flares and fireworks)?', choices: ['Scarlet red', 'Green', 'Lilac', 'Blue'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Calciglow — Calcium (Ca) ---
    { elementId: 'calcium', angle: 'protons', prompt: "Calcium's atomic number is 20. How many protons does it have?", choices: ['2', '18', '20', '40'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'calcium', angle: 'ion',     prompt: 'Calcium (group 2) loses two electrons to form which ion?', choices: ['Ca⁻', 'Ca⁺', 'Ca²⁺', 'Ca²⁻'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'calcium', angle: 'flame',   prompt: 'Calcium burns what colour in a flame test?', choices: ['Orange-red', 'Green', 'Blue', 'Lilac'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Silichip — Silicon (Si) --- (jungle Lesson Two: 3p² )
    { elementId: 'silicon', angle: 'protons', prompt: "Silicon's atomic number is 14. How many protons does it have?", choices: ['4', '14', '18', '28'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'silicon', angle: 'symbol',  prompt: "What is silicon's chemical symbol?", choices: ['S', 'Si', 'Sc', 'Sn'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'silicon', angle: 'config',  prompt: 'Silicon (Z=14) ends its electron configuration with which sublevel?', choices: ['3s² 3p²', '3s² 3p⁴', '3p⁶', '4s² 3d²'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Phosflare — Phosphorus (P) --- (jungle Lesson Two: 3p³ )
    { elementId: 'phosphorus', angle: 'protons', prompt: 'How many protons does phosphorus have?', choices: ['5', '15', '30', '31'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'phosphorus', angle: 'valence', prompt: 'How many valence electrons does phosphorus have (3s² 3p³)?', choices: ['3', '5', '8', '15'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'phosphorus', angle: 'config',  prompt: 'How many electrons are in phosphorus’s 3p sublevel?', choices: ['1', '2', '3', '6'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Argosnooze — Argon (Ar) --- (jungle Lesson Two: full 3p⁶, a noble gas )
    { elementId: 'argon', angle: 'protons', prompt: "Argon's atomic number is 18. How many protons does it have?", choices: ['8', '10', '18', '36'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'argon', angle: 'symbol',  prompt: "What is argon's chemical symbol?", choices: ['Ar', 'Ag', 'Au', 'A'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'argon', angle: 'config',  prompt: 'Why is argon a noble gas that rarely reacts?', choices: ['It has 1 valence electron', 'Its 3s and 3p sublevels are full', 'It is a metal', 'It has no electrons'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Titanoft — Titanium (Ti) --- (City: first-row transition metals)
    { elementId: 'titanium', angle: 'protons', prompt: "Titanium's atomic number is 22. How many protons does it have?", choices: ['12', '20', '22', '48'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'titanium', angle: 'symbol',  prompt: "What is titanium's chemical symbol?", choices: ['Ti', 'T', 'Tn', 'Th'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'titanium', angle: 'block',   prompt: 'Titanium sits in the middle block of the periodic table. It is a…', choices: ['Transition metal (d-block)', 'Noble gas', 'Halogen', 'Alkali metal'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Vanaforge — Vanadium (V) ---
    { elementId: 'vanadium', angle: 'symbol',  prompt: "What is vanadium's chemical symbol?", choices: ['Va', 'V', 'Vn', 'Vd'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'vanadium', angle: 'protons', prompt: "Vanadium's atomic number is 23. How many protons does it have?", choices: ['5', '13', '23', '51'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'vanadium', angle: 'block',   prompt: 'Vanadium is added to steel to make tools harder. It is a…', choices: ['Transition metal', 'Noble gas', 'Nonmetal', 'Alkali metal'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Chromadillo — Chromium (Cr) ---
    { elementId: 'chromium', angle: 'symbol',  prompt: "What is chromium's chemical symbol?", choices: ['Ch', 'Cr', 'Cm', 'Co'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'chromium', angle: 'protons', prompt: 'How many protons does chromium (Z=24) have?', choices: ['6', '16', '24', '52'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'chromium', angle: 'property', prompt: "Shiny 'chrome' plating resists rust, so chromium is valued for being…", choices: ['Corrosion-resistant', 'Radioactive', 'A noble gas', 'Liquid at room temp'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Mangacore — Manganese (Mn) ---
    { elementId: 'manganese', angle: 'symbol',  prompt: "What is manganese's chemical symbol?", choices: ['Mg', 'Mn', 'Ma', 'Mb'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'manganese', angle: 'protons', prompt: "Manganese's atomic number is 25. How many protons does it have?", choices: ['15', '25', '30', '55'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'manganese', angle: 'block',   prompt: 'Manganese sits in the middle of the periodic table. It is a…', choices: ['Transition metal (d-block)', 'Noble gas', 'Halogen', 'Alkali metal'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Co-bolt — Cobalt (Co) ---
    { elementId: 'cobalt', angle: 'symbol',   prompt: "What is cobalt's chemical symbol?", choices: ['C', 'Co', 'Cb', 'Ct'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'cobalt', angle: 'protons',  prompt: 'How many protons does cobalt (Z=27) have?', choices: ['17', '27', '32', '59'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'cobalt', angle: 'property', prompt: 'Cobalt is used in strong magnets and rechargeable battery cathodes. It is a…', choices: ['Magnetic transition metal', 'Noble gas', 'Nonmetal gas', 'Alkali metal'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Nickawatt — Nickel (Ni) ---
    { elementId: 'nickel', angle: 'symbol',   prompt: "What is nickel's chemical symbol?", choices: ['Ni', 'N', 'Nk', 'Ne'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'nickel', angle: 'protons',  prompt: "Nickel's atomic number is 28. How many protons does it have?", choices: ['14', '18', '28', '59'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'nickel', angle: 'property', prompt: 'Nickel is magnetic and used with cobalt in rechargeable batteries and coins. It is a…', choices: ['Transition metal', 'Halogen', 'Noble gas', 'Alkali metal'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Zincoat — Zinc (Zn) --- (2026-10-09 batch)
    { elementId: 'zinc', angle: 'protons',  prompt: "Zinc's atomic number is 30. How many protons does it have?", choices: ['15', '28', '30', '60'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'zinc', angle: 'ion',      prompt: 'Zinc almost always forms an ion with what charge?', choices: ['−2', '+1', '+2', '+3'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'zinc', angle: 'property', prompt: 'Steel is coated ("galvanized") with zinc mainly to protect it from…', choices: ['Rust', 'Sunlight', 'Magnets', 'Heat'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Galli-Melt — Gallium (Ga) ---
    { elementId: 'gallium', angle: 'protons',  prompt: 'How many protons does gallium (atomic number 31) have?', choices: ['13', '29', '31', '41'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'gallium', angle: 'property', prompt: 'Gallium melts at about 30 °C. What happens if you hold a solid piece in your warm hand?', choices: ['It freezes harder', 'It melts into a liquid', 'Nothing changes', 'It catches fire'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'gallium', angle: 'ion',      prompt: 'Gallium is in group 13 with 3 valence electrons. What ion does it commonly form?', choices: ['Ga⁻', 'Ga⁺', 'Ga²⁺', 'Ga³⁺'], correctIndex: 3, quarterTheme: 'starter' },

    // --- Germani-Ray — Germanium (Ge) ---
    { elementId: 'germanium', angle: 'protons',  prompt: "Germanium's atomic number is 32. How many protons does it have?", choices: ['14', '30', '32', '64'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'germanium', angle: 'classify', prompt: 'Germanium sits on the metal/nonmetal staircase and is used in semiconductors. It is a…', choices: ['Metal', 'Noble gas', 'Metalloid', 'Alkali metal'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'germanium', angle: 'valence',  prompt: 'Germanium is in group 14. How many valence electrons does it have?', choices: ['2', '4', '6', '8'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Arsen-Chip — Arsenic (As) ---
    { elementId: 'arsenic', angle: 'protons', prompt: 'How many protons does arsenic (atomic number 33) have?', choices: ['15', '31', '33', '75'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'arsenic', angle: 'symbol',  prompt: "What is arsenic's chemical symbol?", choices: ['Ar', 'As', 'Au', 'A'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'arsenic', angle: 'valence', prompt: 'Arsenic is in group 15. How many valence electrons does it have?', choices: ['3', '5', '7', '8'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Solenium — Selenium (Se) ---
    { elementId: 'selenium', angle: 'protons',  prompt: "Selenium's atomic number is 34. How many protons does it have?", choices: ['16', '32', '34', '68'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'selenium', angle: 'ion',      prompt: 'Selenium is in group 16 and tends to gain 2 electrons. What ion does it form?', choices: ['Se⁺', 'Se²⁺', 'Se⁻', 'Se²⁻'], correctIndex: 3, quarterTheme: 'starter' },
    { elementId: 'selenium', angle: 'property', prompt: 'Selenium conducts electricity better in light than in dark, so it is used in…', choices: ['Batteries', 'Solar cells and light sensors', 'Magnets', 'Balloons'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Brome-Garde — Bromine (Br) ---
    { elementId: 'bromine', angle: 'protons',  prompt: 'How many protons does bromine (atomic number 35) have?', choices: ['17', '35', '45', '80'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'bromine', angle: 'property', prompt: 'Bromine is unusual because at room temperature it is a…', choices: ['Solid metal', 'Red-brown liquid', 'Green solid', 'Colorless gas'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'bromine', angle: 'ion',      prompt: 'Bromine is a halogen in group 17. What ion does it form?', choices: ['Br⁺', 'Br⁻', 'Br²⁻', 'Br (no charge)'], correctIndex: 1, quarterTheme: 'starter' },

    // --- Krypto-Glow — Krypton (Kr) ---
    { elementId: 'krypton', angle: 'protons', prompt: "Krypton's atomic number is 36. How many protons does it have?", choices: ['18', '34', '36', '72'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'krypton', angle: 'config',  prompt: 'Why does krypton, a noble gas, almost never react?', choices: ['It has 1 valence electron', 'Its outer shell is full', 'It is a metal', 'It has no protons'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'krypton', angle: 'valence', prompt: 'How many valence electrons does krypton have in its outer shell?', choices: ['2', '6', '8', '18'], correctIndex: 2, quarterTheme: 'starter' },

    // --- Rubi-Clock — Rubidium (Rb) ---
    { elementId: 'rubidium', angle: 'protons', prompt: 'How many protons does rubidium (atomic number 37) have?', choices: ['19', '37', '48', '85'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'rubidium', angle: 'ion',     prompt: 'Rubidium is an alkali metal in group 1. What ion does it form?', choices: ['Rb⁻', 'Rb⁺', 'Rb²⁺', 'Rb³⁺'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'rubidium', angle: 'valence', prompt: 'Like sodium and potassium, rubidium is very reactive. How many valence electrons does it have?', choices: ['1', '2', '7', '8'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Zirc-Armor — Zirconium (Zr) --- (2026-10-09 batch 2)
    { elementId: 'zirconium', angle: 'protons', prompt: "Zirconium's atomic number is 40. How many protons does it have?", choices: ['20', '38', '40', '91'], correctIndex: 2, quarterTheme: 'starter' },
    { elementId: 'zirconium', angle: 'symbol',  prompt: "What is zirconium's chemical symbol?", choices: ['Zi', 'Zr', 'Zn', 'Zc'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'zirconium', angle: 'block',   prompt: 'Zirconium resists heat and corrosion and sits in the middle of the periodic table. It is a…', choices: ['Transition metal (d-block)', 'Noble gas', 'Halogen', 'Alkali metal'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Nio-Coil — Niobium (Nb) ---
    { elementId: 'niobium', angle: 'protons',  prompt: 'How many protons does niobium (atomic number 41) have?', choices: ['21', '41', '51', '93'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'niobium', angle: 'symbol',   prompt: "What is niobium's chemical symbol?", choices: ['Ni', 'Nb', 'No', 'N'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'niobium', angle: 'property', prompt: 'Niobium is used in the superconducting magnets of MRI machines because when very cold it carries electricity with…', choices: ['No resistance', 'More rust', 'Less gravity', 'Bright light'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Moly-Glide — Molybdenum (Mo) ---
    { elementId: 'molybdenum', angle: 'protons',  prompt: "Molybdenum's atomic number is 42. How many protons does it have?", choices: ['22', '42', '54', '96'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'molybdenum', angle: 'symbol',   prompt: "What is molybdenum's chemical symbol?", choices: ['Ml', 'Mo', 'Md', 'Mb'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'molybdenum', angle: 'property', prompt: 'Molybdenum has a very high melting point, so it is added to steel to make it…', choices: ['Stronger at high heat', 'Softer', 'Magnetic', 'Radioactive'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Techne-Scan — Technetium (Tc) ---
    { elementId: 'technetium', angle: 'protons',  prompt: 'How many protons does technetium (atomic number 43) have?', choices: ['23', '43', '53', '99'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'technetium', angle: 'property', prompt: 'Technetium was the first element made artificially in a lab. Every isotope of it is…', choices: ['Radioactive', 'A noble gas', 'A liquid', 'Magnetic'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'technetium', angle: 'property', prompt: 'Doctors inject a tiny amount of technetium-99m to take pictures inside the body. This makes it useful in…', choices: ['Medical imaging scans', 'Batteries', 'Fireworks', 'Magnets'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Ruthen-Spark — Ruthenium (Ru) ---
    { elementId: 'ruthenium', angle: 'protons', prompt: "Ruthenium's atomic number is 44. How many protons does it have?", choices: ['24', '44', '54', '101'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'ruthenium', angle: 'symbol',  prompt: "What is ruthenium's chemical symbol?", choices: ['Ru', 'Rh', 'Rn', 'R'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'ruthenium', angle: 'block',   prompt: 'Ruthenium is a hard, silvery metal from the middle of the periodic table. It is a…', choices: ['Transition metal', 'Noble gas', 'Alkali metal', 'Halogen'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Rhodi-Mirror — Rhodium (Rh) ---
    { elementId: 'rhodium', angle: 'protons',  prompt: 'How many protons does rhodium (atomic number 45) have?', choices: ['25', '45', '58', '103'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'rhodium', angle: 'symbol',   prompt: "What is rhodium's chemical symbol?", choices: ['Rd', 'Rh', 'Ro', 'Re'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'rhodium', angle: 'property', prompt: 'Rhodium is a rare, costly metal used to make mirrors and jewelry bright. It is prized for being…', choices: ['Highly reflective', 'Radioactive', 'A gas', 'Magnetic'], correctIndex: 0, quarterTheme: 'starter' },

    // --- Palla-Sponge — Palladium (Pd) ---
    { elementId: 'palladium', angle: 'protons',  prompt: "Palladium's atomic number is 46. How many protons does it have?", choices: ['26', '46', '60', '106'], correctIndex: 1, quarterTheme: 'starter' },
    { elementId: 'palladium', angle: 'symbol',   prompt: "What is palladium's chemical symbol?", choices: ['Pd', 'Pa', 'Pl', 'P'], correctIndex: 0, quarterTheme: 'starter' },
    { elementId: 'palladium', angle: 'property', prompt: 'Palladium can soak up large amounts of hydrogen gas, acting like a…', choices: ['Sponge', 'Magnet', 'Battery', 'Mirror'], correctIndex: 0, quarterTheme: 'starter' },
];

/** All seed questions for one element. */
export function questionsForElement(elementId: string): Question[] {
    return QUESTIONS.filter(q => q.elementId === elementId);
}

/** Pick a random seed question for an element (undefined if none). */
export function randomQuestionForElement(elementId: string): Question | undefined {
    const pool = questionsForElement(elementId);
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
}
