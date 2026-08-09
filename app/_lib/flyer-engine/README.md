# Flyer engine

Everything needed to turn a few fields into a printable, correctly-sized,
correctly-spelled advertisement — and **nothing else**.

`index.ts` imports nothing. Not Next, not Supabase, not a single package. That
is deliberate and it is enforced by `__tests__/portable.test.ts`, which fails
the moment an import appears.

## Why it is separate

This is the part worth keeping if the flyer maker ever becomes its own product
or gets white-labelled. Because it stands alone, moving it is a copy — not a
rewrite. The moment it reaches for a database client or an auth helper, that
stops being true, and in practice you find out years later when it is expensive.

If you need something from the app, do it in the route and pass the result in.

## What is in here

| | |
|---|---|
| `FLYER_SIZES` | Every output size, print and digital |
| `apiSize()` | What to actually ask the image API for, so nothing is cropped |
| `FLYER_TEMPLATES` | The looks — each one is art direction for the scene *and* the lettering |
| `flyerPrompt()` | Assembles the instruction that produces the finished design |
| `PHOTO_ROLES` | What a customer's uploaded photo is, which decides how it is used |

## The expensive knowledge

`apiSize()` looks fussy. Every rule in it cost a rejected request to learn:

- both dimensions must divide by 16
- the aspect ratio may not exceed 3:1 in either direction
- the longest edge may not exceed 3840
- there is a pixel budget *and* a floor — 8.4 MP was refused, so was 0.44 MP

An earlier version assumed the API offered three fixed shapes and cropped
everything else to fit. That was wrong, and it was why banners arrived with
their text sliced off. Twelve of the thirteen sizes are now generated at their
own aspect ratio and never cropped at all; only the 4:1 LinkedIn strip falls
outside what the API will draw.

`flyerPrompt()` carries hard-won rules too — the safe margin (added after
headlines came back clipped), quoting every supplied string verbatim, and
omitting empty fields entirely, because a model handed `Price:` with nothing
after it will invent a price.

The tests cover all of it. If one fails, something that used to work in
production has quietly stopped.
