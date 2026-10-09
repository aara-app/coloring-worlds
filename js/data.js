/* Coloring Worlds — theme & page manifest (v1: 6 themes, 60 pages, 3 age tiers each) */
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
      sthumb: "assets/pages/" + theme + "/simple-" + id + "-thumb.png",
      // richly detailed versions for age 6-8
      dfile: "assets/pages/" + theme + "/detail-" + id + ".png",
      dthumb: "assets/pages/" + theme + "/detail-" + id + "-thumb.png"
    };
  }

  var THEMES = [
    { id: "farm",        title: "Farm Animals",     common: true,  free: true,  iconPage: "cow",
      gradient: "linear-gradient(160deg,#8ee06a 0%,#3faf4e 100%)",
      pages: [
        pg("farm", "cow", "Cow"), pg("farm", "pig", "Pig"),
        pg("farm", "chicken", "Chicken"), pg("farm", "horse", "Horse"),
        pg("farm", "sheep", "Sheep"), pg("farm", "barn", "Barn"),
        pg("farm", "tractor", "Tractor"), pg("farm", "duck", "Duck"),
        pg("farm", "goat", "Goat"), pg("farm", "farmer", "Farmer")
      ] },
    { id: "wild",        title: "Wild Animals",     common: true,  free: true,  iconPage: "lion",
      gradient: "linear-gradient(160deg,#ffb347 0%,#ff7b2e 100%)",
      pages: [
        pg("wild", "lion", "Lion"), pg("wild", "elephant", "Elephant"),
        pg("wild", "giraffe", "Giraffe"), pg("wild", "zebra", "Zebra"),
        pg("wild", "monkey", "Monkey"), pg("wild", "tiger", "Tiger"),
        pg("wild", "kangaroo", "Kangaroo"), pg("wild", "panda", "Panda"),
        pg("wild", "hippo", "Hippo"), pg("wild", "rhino", "Rhino")
      ] },
    { id: "princess",    title: "Princess Castle",  genders: ["girl"], free: false, iconPage: "princess",
      gradient: "linear-gradient(160deg,#ff9ecf 0%,#f0569d 100%)",
      pages: [
        pg("princess", "princess", "Princess"), pg("princess", "gardenprincess", "Garden Princess"),
        pg("princess", "dancingprincess", "Dancing Princess"), pg("princess", "ponyprincess", "Princess & Pony"),
        pg("princess", "teaparty", "Tea Party"), pg("princess", "readingprincess", "Story Time"),
        pg("princess", "balconyprincess", "Castle Balcony"), pg("princess", "birthdayprincess", "Birthday Princess"),
        pg("princess", "butterflyprincess", "Butterfly Friends"), pg("princess", "bedtimeprincess", "Bedtime Princess")
      ] },
    { id: "baby",        title: "Baby Animals",     genders: ["girl"], free: false, iconPage: "puppy",
      gradient: "linear-gradient(160deg,#c9a7f5 0%,#8b5cf0 100%)",
      pages: [
        pg("baby", "puppy", "Puppy"), pg("baby", "kitten", "Kitten"),
        pg("baby", "bunny", "Bunny"), pg("baby", "chick", "Chick"),
        pg("baby", "lamb", "Lamb"), pg("baby", "calf", "Calf"),
        pg("baby", "piglet", "Piglet"), pg("baby", "duckling", "Duckling"),
        pg("baby", "foal", "Foal"), pg("baby", "cub", "Lion Cub")
      ] },
    { id: "dino",        title: "Dino Land",        genders: ["boy"],  free: false, iconPage: "trex",
      gradient: "linear-gradient(160deg,#4fe3a5 0%,#0ea5a5 100%)",
      pages: [
        pg("dino", "trex", "T-Rex"), pg("dino", "triceratops", "Triceratops"),
        pg("dino", "brontosaurus", "Brontosaurus"), pg("dino", "stegosaurus", "Stegosaurus"),
        pg("dino", "pterodactyl", "Pterodactyl"), pg("dino", "babydino", "Baby Dino"),
        pg("dino", "volcano", "Volcano"), pg("dino", "dinofamily", "Dino Family"),
        pg("dino", "velociraptor", "Velociraptor"), pg("dino", "dinoegg", "Dino Egg")
      ] },
    { id: "construction", title: "Construction Site", genders: ["boy"], free: false, iconPage: "bulldozer",
      gradient: "linear-gradient(160deg,#5ec8ff 0%,#2f7fe0 100%)",
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
      svg: '<img src="assets/ui/interest-cars.png" alt="">' },
    { id: "dinos", label: "Dinos",
      svg: '<img src="assets/ui/interest-dinos.png" alt="">' },
    { id: "princess", label: "Princess",
      svg: '<img src="assets/ui/interest-princess.png" alt="">' },
    { id: "animals", label: "Animals",
      svg: '<img src="assets/ui/interest-animals.png" alt="">' },
    { id: "space", label: "Space",
      svg: '<img src="assets/ui/interest-space.png" alt="">' },
    { id: "ocean", label: "Ocean",
      svg: '<img src="assets/ui/interest-ocean.png" alt="">' }
  ];

  /* Studio palette: first 12 (brightest kid colors) free, rest premium-locked */
  var PALETTE_FREE = [
    "#ff3b30", "#ff9500", "#ffcc00", "#34c759",
    "#00c7be", "#0a84ff", "#bf5af2", "#ff375f",
    "#000000", "#ffffff", "#8b5a2b", "#8e8e93"
  ];
  var PALETTE_LOCKED = [
    "#5ac8fa", "#4cd964", "#ff2d92", "#ff6b6b",
    "#7d4fc9", "#0d47a1", "#b26a00", "#2e7d32",
    "#c2185b", "#00acc1", "#6d4c41", "#e6a817",
    "#ff8a80", "#ffd180", "#ffff8d", "#ccff90",
    "#a7ffeb", "#80d8ff", "#8c9eff", "#ea80fc",
    "#795548", "#607d8b", "#26a69a", "#d4e157"
  ];
  /* legacy alias: default color etc. */
  var PALETTE = PALETTE_FREE;

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
    PALETTE_FREE: PALETTE_FREE, PALETTE_LOCKED: PALETTE_LOCKED,
    themeById: themeById, visibleThemes: visibleThemes
  };
})();
