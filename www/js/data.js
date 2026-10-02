/* Coloring Worlds — theme & page manifest (v1: 6 themes, 40 pages) */
(function () {
  "use strict";

  function pg(theme, id, title) {
    return {
      id: id,
      title: title,
      file: "assets/pages/" + theme + "/" + id + ".png",
      thumb: "assets/pages/" + theme + "/" + id + "-thumb.png",
      // ultra-simple bold versions for age 0-2
      sfile: "assets/pages/" + theme + "/simple-" + id + ".png",
      sthumb: "assets/pages/" + theme + "/simple-" + id + "-thumb.png"
    };
  }

  var THEMES = [
    { id: "farm",        title: "Farm Animals",     common: true,  iconPage: "cow",
      pages: [
        pg("farm", "cow", "Cow"), pg("farm", "pig", "Pig"),
        pg("farm", "chicken", "Chicken"), pg("farm", "horse", "Horse"),
        pg("farm", "sheep", "Sheep"), pg("farm", "barn", "Barn"),
        pg("farm", "tractor", "Tractor"), pg("farm", "duck", "Duck"),
        pg("farm", "goat", "Goat"), pg("farm", "farmer", "Farmer")
      ] },
    { id: "wild",        title: "Wild Animals",     common: true,  iconPage: "lion",
      pages: [
        pg("wild", "lion", "Lion"), pg("wild", "elephant", "Elephant"),
        pg("wild", "giraffe", "Giraffe"), pg("wild", "zebra", "Zebra"),
        pg("wild", "monkey", "Monkey"), pg("wild", "tiger", "Tiger"),
        pg("wild", "kangaroo", "Kangaroo"), pg("wild", "panda", "Panda"),
        pg("wild", "hippo", "Hippo"), pg("wild", "rhino", "Rhino")
      ] },
    { id: "princess",    title: "Princess Castle",  genders: ["girl"], iconPage: "princess",
      pages: [
        pg("princess", "princess", "Princess"), pg("princess", "castle", "Castle"),
        pg("princess", "crown", "Crown"), pg("princess", "ballgown", "Ball Gown"),
        pg("princess", "carriage", "Carriage"), pg("princess", "tiara", "Tiara"),
        pg("princess", "magicwand", "Magic Wand"), pg("princess", "throne", "Throne"),
        pg("princess", "prince", "Prince"), pg("princess", "royalgarden", "Royal Garden")
      ] },
    { id: "baby",        title: "Baby Animals",     genders: ["girl"], iconPage: "puppy",
      pages: [
        pg("baby", "puppy", "Puppy"), pg("baby", "kitten", "Kitten"),
        pg("baby", "bunny", "Bunny"), pg("baby", "chick", "Chick"),
        pg("baby", "lamb", "Lamb"), pg("baby", "calf", "Calf"),
        pg("baby", "piglet", "Piglet"), pg("baby", "duckling", "Duckling"),
        pg("baby", "foal", "Foal"), pg("baby", "cub", "Lion Cub")
      ] },
    { id: "dino",        title: "Dino Land",        genders: ["boy"],  iconPage: "trex",
      pages: [
        pg("dino", "trex", "T-Rex"), pg("dino", "triceratops", "Triceratops"),
        pg("dino", "brontosaurus", "Brontosaurus"), pg("dino", "stegosaurus", "Stegosaurus"),
        pg("dino", "pterodactyl", "Pterodactyl"), pg("dino", "babydino", "Baby Dino"),
        pg("dino", "volcano", "Volcano"), pg("dino", "dinofamily", "Dino Family"),
        pg("dino", "velociraptor", "Velociraptor"), pg("dino", "dinoegg", "Dino Egg")
      ] },
    { id: "construction", title: "Construction Site", genders: ["boy"], iconPage: "bulldozer",
      pages: [
        pg("construction", "bulldozer", "Bulldozer"), pg("construction", "crane", "Crane"),
        pg("construction", "dumptruck", "Dump Truck"), pg("construction", "excavator", "Excavator"),
        pg("construction", "cementmixer", "Cement Mixer"), pg("construction", "worker", "Worker"),
        pg("construction", "roadroller", "Road Roller"), pg("construction", "scaffolding", "Scaffolding"),
        pg("construction", "toolbox", "Toolbox"), pg("construction", "trafficcone", "Traffic Cone")
      ] }
  ];

  /* interest -> theme relevance for ordering theme cards */
  var INTEREST_THEMES = {
    cars: ["construction"],
    dinos: ["dino"],
    princess: ["princess"],
    animals: ["farm", "wild", "baby"],
    space: [],
    ocean: []
  };

  var INTERESTS = [
    { id: "cars", label: "Cars",
      svg: '<svg viewBox="0 0 48 48"><path d="M6 30l4-10a4 4 0 0 1 3.8-2.6h20.4A4 4 0 0 1 38 20l4 10v6h-4a4 4 0 0 1-8 0H18a4 4 0 0 1-8 0H6v-6z" fill="#ff6b6b"/><circle cx="14" cy="36" r="4" fill="#333"/><circle cx="34" cy="36" r="4" fill="#333"/><rect x="16" y="22" width="16" height="6" rx="2" fill="#bfe8ff"/></svg>' },
    { id: "dinos", label: "Dinos",
      svg: '<svg viewBox="0 0 48 48"><path d="M8 38c0-8 4-14 10-18-1-4 1-8 5-10 3 3 8 4 12 3l5 8-6 2c1 5-1 10-5 13l-3 2H12l-4-4z" fill="#4fe3a5"/><circle cx="30" cy="14" r="2" fill="#223"/></svg>' },
    { id: "princess", label: "Princess",
      svg: '<svg viewBox="0 0 48 48"><path d="M8 36l-2-16 8 6 4-12 4 10 4-10 4 12 8-6-2 16H8z" fill="#ffd93d"/><rect x="10" y="36" width="28" height="4" rx="2" fill="#ff9f43"/><circle cx="24" cy="42" r="2.5" fill="#ff6b9d"/></svg>' },
    { id: "animals", label: "Animals",
      svg: '<svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="12" fill="#ffb26b"/><circle cx="14" cy="14" r="5" fill="#ffb26b"/><circle cx="34" cy="14" r="5" fill="#ffb26b"/><circle cx="14" cy="14" r="2" fill="#ff9f9f"/><circle cx="34" cy="14" r="2" fill="#ff9f9f"/><circle cx="19" cy="24" r="2" fill="#333"/><circle cx="29" cy="24" r="2" fill="#333"/><ellipse cx="24" cy="30" rx="3" ry="2.4" fill="#333"/></svg>' },
    { id: "space", label: "Space",
      svg: '<svg viewBox="0 0 48 48"><path d="M24 6c4 6 8 10 8 18a8 8 0 0 1-16 0c0-8 4-12 8-18z" fill="#a78bfa"/><circle cx="24" cy="24" r="4" fill="#fff"/><path d="M20 36l-2 6M28 36l2 6" stroke="#ff9f43" stroke-width="3" stroke-linecap="round"/></svg>' },
    { id: "ocean", label: "Ocean",
      svg: '<svg viewBox="0 0 48 48"><path d="M6 30c4-2 8 2 12 0s8 2 12 0 8 2 12 0v8H6v-8z" fill="#4dabff"/><path d="M14 22c4-6 12-8 18-4l4 6-8 2c-4 2-10 0-14-4z" fill="#ff9f43"/><circle cx="30" cy="20" r="1.6" fill="#223"/></svg>' }
  ];

  var PALETTE = [
    "#ff3b30", "#ff9500", "#ffcc00", "#34c759",
    "#00c7be", "#0a84ff", "#bf5af2", "#ff375f",
    "#8b5a2b", "#000000", "#ffffff", "#8e8e93"
  ];

  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
  }
  function visibleThemes(gender, interests) {
    var list = THEMES.filter(function (t) {
      return t.common || (t.genders && t.genders.indexOf(gender) !== -1);
    });
    if (interests && interests.length) {
      var score = {};
      interests.forEach(function (inId) {
        (INTEREST_THEMES[inId] || []).forEach(function (tId) { score[tId] = (score[tId] || 0) + 1; });
      });
      list.sort(function (a, b) { return (score[b.id] || 0) - (score[a.id] || 0); });
    }
    return list;
  }

  window.CW_DATA = {
    THEMES: THEMES, INTERESTS: INTERESTS, PALETTE: PALETTE,
    themeById: themeById, visibleThemes: visibleThemes
  };
})();
