#!/usr/bin/env python3
"""Manifest for the 2026-10-10 DETAIL-tier restyle (ages 6-8).

New style per Raji's Crayola reference: cool/dynamic subjects, full scenes,
LARGE colorable elements. No baby faces, no pattern/mandala/doodle fills.
"""
STYLE = (
    "Coloring page for older kids ages 6-8. Bold clean black outlines on pure "
    "white background. The subject is drawn cool and dynamic, in an action pose, "
    "with a confident expression and normal realistic proportions - NOT babyish, "
    "no chibi style, no huge sparkle eyes, no blush cheeks, no cute baby face. "
    "Around the subject is a full rich scene with many large distinct elements "
    "to color. Every element is one large closed region big enough to color in. "
    "Absolutely NO tiny patterns, NO mandala or doodle decoration fills, NO "
    "confetti dots, no shading, no gray tones, no text. Square composition, "
    "subject large and central."
)

# theme -> list of (page_id, subject, scene_elements, extra_style_notes)
PAGES = {
    "farm": [
        ("cow", "a strong dairy cow mid-stride walking through a pasture, head held high",
         "red barn with big doors, wooden fence, round hay bale, apple tree, rolling hills, big sun, puffy clouds, grass tufts, dirt path", ""),
        ("pig", "a sturdy pig trotting through a farmyard, tail curled",
         "barn, big mud puddle, wooden fence, feeding trough, hay bales, hills, sun, clouds", ""),
        ("chicken", "a proud rooster with a magnificent big tail standing on a fence post crowing at sunrise",
         "wooden fence, barn, big rising sun with rays, corn stalks, rolling hills, clouds, grass", ""),
        ("horse", "a powerful horse galloping across a meadow, mane flowing",
         "wooden fence, distant barn, rolling hills, big trees, sun, clouds, flowers, grass tufts", ""),
        ("sheep", "a woolly sheep standing alert on a grassy hilltop",
         "rolling hills, wooden fence, small barn, leafy tree, sun, clouds, flowers, grass", ""),
        ("barn", "a big classic farm barn with a tall silo and a windmill",
         "barn doors and windows, silo, windmill, wooden fence, hay bales, leafy trees, crop field rows, dirt path, sun, clouds", ""),
        ("tractor", "a big powerful tractor driving through a field pulling a wagon loaded with hay bales",
         "barn, wooden fence, hay bales, crop rows, rolling hills, sun, clouds, trees", ""),
        ("duck", "a duck flapping its wings as it lands on a farm pond",
         "pond water, tall reeds, lily pads, wooden fence, small barn, grassy bank, sun, clouds, hills", ""),
        ("goat", "a nimble goat standing proudly on top of a rocky mound in the farmyard",
         "big rocks, wooden fence, barn, hay bale, leafy tree, hills, sun, clouds", ""),
        ("farmer", "a farmer in overalls and a wide hat carrying a crate full of vegetables, walking through the farm",
         "barn, tractor, wooden fence, vegetable crop rows, hay bales, rolling hills, sun, clouds", ""),
    ],
    "wild": [
        ("lion", "a majestic male lion with a huge full mane standing on a rock roaring",
         "acacia tree, big rocks, savanna grass, rolling hills, big sun, clouds, small birds in the sky", ""),
        ("elephant", "a mighty African elephant striding across the savanna with its trunk raised high",
         "acacia trees, watering hole, big rocks, savanna grass, hills, big sun, clouds, birds", ""),
        ("giraffe", "a tall giraffe stretching its long neck up to eat leaves from the top of an acacia tree",
         "acacia trees, savanna grass, big rocks, hills, sun, clouds, birds", ""),
        ("zebra", "a zebra galloping fast across the savanna, mane flying",
         "acacia tree, rolling hills, savanna grass tufts, big rocks, sun, clouds", ""),
        ("monkey", "an agile monkey swinging through the jungle on a long vine",
         "big jungle leaves, tall trees, a bunch of bananas, large flowers, vines, sun shining through the canopy", ""),
        ("tiger", "a powerful tiger prowling low through tall jungle grass",
         "bamboo stalks, big tropical leaves, rocks, a stream, tall trees", ""),
        ("kangaroo", "a strong kangaroo leaping high across the Australian outback",
         "big red rocks, eucalyptus tree, dry grass tufts, hills, big sun, clouds", ""),
        ("panda", "a giant panda climbing up a thick bamboo stalk in a bamboo forest",
         "bamboo forest, big rocks, distant mountains, large leaves, sun", ""),
        ("hippo", "a huge hippopotamus in a river opening its enormous mouth wide",
         "river water, tall reeds, lily pads, leafy trees, hills, sun, birds", ""),
        ("rhino", "a mighty rhinoceros standing strong beside a muddy watering hole, head lowered",
         "acacia tree, big rocks, mud puddle, savanna grass, hills, big sun, clouds", ""),
    ],
    "princess": [
        ("princess", "an elegant princess in a flowing gown standing on the castle steps waving gracefully",
         "castle towers with flags, wide staircase, rose bushes, a fountain, sun, clouds, birds", ""),
        ("gardenprincess", "a princess watering tall flowers with a watering can in a castle garden",
         "a fountain, rose bushes, shaped topiary bushes, castle wall, big tree, butterflies, sun", ""),
        ("dancingprincess", "a princess twirling in an elegant dance pose in a grand ballroom",
         "a big chandelier, tall arched windows, grand staircase, long curtains, pillars, hanging banners", ""),
        ("ponyprincess", "a princess riding a graceful pony along a castle path",
         "castle with towers, a stable, wooden fence, rolling hills, big trees, flowers, sun, clouds", ""),
        ("teaparty", "a princess pouring tea from a teapot at a garden tea party table",
         "a table with teapot, cups and a tall cake stand, chairs, castle in the background, big trees, rose bushes, sun", ""),
        ("readingprincess", "a princess sitting on a garden bench reading a big open book",
         "a big leafy tree, castle towers behind, rose bushes, flowers, birds, sun, clouds", ""),
        ("balconyprincess", "a princess standing on a castle balcony looking out over the kingdom",
         "balcony railing, castle towers with flags, distant mountains, a river, sun, clouds, birds", ""),
        ("birthdayprincess", "a princess celebrating beside a tall birthday cake at a party in the castle hall",
         "a big layered cake on a table, balloons, bunting banners, wrapped presents, chairs, tall windows", ""),
        ("butterflyprincess", "a princess reaching out gently toward butterflies in a flower meadow",
         "large flowers, butterflies, castle in the background, big trees, rolling hills, bushes, sun", ""),
        ("bedtimeprincess", "a princess in a nightgown holding a lantern beside a castle window at night",
         "a big moon, large stars, a canopy bed, long curtains, castle tower, an open storybook", ""),
    ],
    "baby": [
        ("puppy", "an energetic young dog chasing a ball across a yard",
         "wooden fence, a dog house, a big ball, leafy trees, grass, flowers, sun, clouds", ""),
        ("kitten", "a lively young cat pouncing through a garden after a butterfly",
         "large flowers, wooden fence, big tree, grass, a butterfly, sun, clouds", ""),
        ("bunny", "a swift rabbit leaping through a flower meadow",
         "a carrot patch, large flowers, rolling hills, big trees, grass, sun, clouds", ""),
        ("chick", "a young chicken strutting proudly through a farmyard, wings slightly spread",
         "wooden fence, barn wall, scattered hay, a water bowl, grass, sun, clouds", ""),
        ("lamb", "a young sheep leaping playfully over a grassy mound in a pasture",
         "wooden fence, rolling hills, large flowers, leafy tree, grass, sun, clouds", ""),
        ("calf", "a young calf trotting through a pasture",
         "barn, wooden fence, round hay bale, rolling hills, leafy tree, sun, clouds", ""),
        ("piglet", "a young pig splashing energetically in a big mud puddle",
         "barn, wooden fence, feeding trough, mud puddle, hills, sun, clouds", ""),
        ("duckling", "a young duck diving into a pond with a splash",
         "pond water, tall reeds, lily pads, big rocks, leafy trees, sun, clouds", ""),
        ("foal", "a young horse galloping across a meadow, legs stretched out",
         "wooden fence, rolling hills, big trees, large flowers, grass, sun, clouds", ""),
        ("cub", "a young lion cub pouncing down from a savanna rock",
         "acacia tree, big rocks, savanna grass, rolling hills, big sun, clouds", ""),
    ],
    "dino": [
        ("trex", "a ferocious Tyrannosaurus rex roaring in a prehistoric valley, jaws open",
         "an erupting volcano, palm trees, big rocks, a huge sun, giant ferns, mountains", ""),
        ("triceratops", "a mighty Triceratops charging forward through giant ferns, head low",
         "palm trees, big rocks, a volcano, sun, prehistoric plants, hills", ""),
        ("brontosaurus", "a gigantic Brontosaurus stretching its long neck up to eat leaves from a tall tree",
         "tall prehistoric trees, giant ferns, a river, hills, sun, clouds", ""),
        ("stegosaurus", "a Stegosaurus with tall back plates walking among giant ferns and rocks",
         "palm trees, big rocks, a volcano, sun, large plants", ""),
        ("pterodactyl", "a Pterodactyl soaring with huge wings spread over coastal cliffs",
         "tall cliffs, the sea, palm trees, big rocks, a huge sun, clouds", ""),
        ("babydino", "a young dinosaur standing proudly beside its cracked eggshell in a fern clearing, head held high",
         "broken eggshell pieces, giant ferns, palm trees, a volcano, big rocks, sun", ""),
        ("volcano", "a massive volcano erupting with lava streams flowing down its sides",
         "lava flows, a big ash cloud, palm trees, big rocks, hills, giant ferns, sun", ""),
        ("dinofamily", "an adult long-neck dinosaur and a young one walking together through a green valley",
         "palm trees, a river, a volcano, giant ferns, big rocks, sun, clouds", ""),
        ("velociraptor", "a swift Velociraptor sprinting through a prehistoric jungle, claws out",
         "huge palm fronds, a giant sun, jagged mountains, big rocks, large plants, layered ground", ""),
        ("dinoegg", "a nest of huge dinosaur eggs with one egg cracking open, in a jungle clearing",
         "a big nest, giant ferns, palm trees, big rocks, a volcano in the distance, sun", ""),
    ],
    "construction": [
        ("bulldozer", "a powerful bulldozer pushing a big pile of dirt and rocks at a construction site",
         "dirt piles, big rocks, traffic cones, a half-built building, a crane in the background, sun, clouds", ""),
        ("crane", "a towering construction crane lifting a long steel beam high into the air",
         "a building frame under construction, steel beams, traffic cones, safety barriers, sun, clouds", ""),
        ("dumptruck", "a heavy dump truck tipping its bed to unload a load of gravel",
         "a gravel pile, traffic cones, safety barriers, a building under construction, dirt mounds, sun", ""),
        ("excavator", "a big excavator digging into the ground with its toothed bucket raised",
         "a dirt pile, big rocks, traffic cones, large pipes, a building frame, sun, clouds", ""),
        ("cementmixer", "a cement mixer truck pouring wet concrete from its chute onto a foundation",
         "a concrete foundation slab, safety barriers, traffic cones, a building under construction, a wheelbarrow, sun", ""),
        ("worker", "a construction worker in a hard hat holding a big wrench, standing proudly at the site",
         "a building frame, a crane, traffic cones, a toolbox, safety barriers, sun, clouds", ""),
        ("roadroller", "a massive road roller flattening a brand-new road",
         "road layers, traffic cones, safety barriers, buildings, trees, sun, clouds", ""),
        ("scaffolding", "tall scaffolding built against a building under construction, with planks and ladders",
         "the building wall with windows, scaffold poles and platforms, a crane, traffic cones, sun, clouds", ""),
        ("toolbox", "a big open toolbox with large tools - a hammer, a wrench, a saw and a drill - on a workbench at a construction site",
         "a workbench, traffic cones, a building under construction behind, a hard hat, sun, clouds", ""),
        ("trafficcone", "a roadworks scene with several big traffic cones and striped barriers lining a road being repaired",
         "large cones, striped road barriers, a dug-up road patch, buildings, a blank work sign post, sun, clouds", ""),
    ],
    "halloween": [
        ("pumpkin", "a huge carved jack-o'-lantern with a bold grin sitting on a porch, with more big pumpkins around it",
         "house porch steps, a wooden fence, a bare tree, a big moon, fallen leaves, hills",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("ghost", "a dramatic ghost swooping through a spooky graveyard with arms spread wide",
         "tall tombstones, a bare twisted tree, a big moon, an iron fence, pumpkins, hills",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("witch", "a witch flying fast on a broomstick across a giant full moon, cape flowing",
         "a huge moon, rooftops with chimneys, bare trees, clouds, hills",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("blackcat", "a sleek black cat prowling along a fence at night, tail up, eyes alert",
         "a wooden fence, a big moon, pumpkins, a bare tree, a house, fallen leaves",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("candybucket", "a huge bucket overflowing with wrapped candies and lollipops on a porch step",
         "porch steps, a front door, pumpkins, a big moon, fallen leaves, a house wall",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("hauntedhouse", "a tall spooky haunted house on a hill with crooked towers and big windows",
         "the house with a crooked tower, bare twisted trees, a big moon, an iron fence, tombstones, a winding path, pumpkins",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("bat", "a group of bats with wide wings flying around a giant full moon over rooftops",
         "a huge moon, clouds, rooftops with chimneys, a bare tree, hills",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("owl", "a wise owl with broad wings perched on a thick branch, staring straight ahead",
         "a big tree branch, a full moon, bare trees, pumpkins below, hills, fallen leaves",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("mummy", "a mummy striding out of an ancient stone tomb doorway, bandages trailing",
         "stone pillars, a tomb entrance, torches, big rocks, a moon, desert hills",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
        ("trickortreat", "two kids in Halloween costumes - a witch and a ghost - walking up a path carrying candy bags",
         "a house with a lit porch, pumpkins, a big moon, a wooden fence, bare trees, a winding path",
         " Friendly Halloween mood - spooky-fun, never scary, no gore."),
    ],
}

THEME_ORDER = ["farm", "wild", "halloween", "princess", "baby", "dino", "construction"]


def prompt_for(theme, page_id):
    for pid, subject, elements, extra in PAGES[theme]:
        if pid == page_id:
            return ("Coloring page for older kids ages 6-8: " + subject + ". " + STYLE +
                    " Scene elements to include, all large: " + elements + "." + extra)
    raise KeyError(page_id)


if __name__ == "__main__":
    total = sum(len(v) for v in PAGES.values())
    print("pages:", total)
    for t in THEME_ORDER:
        print(t, len(PAGES[t]))
