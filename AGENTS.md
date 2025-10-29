This project is using the React compiler; avoid using useCallback and useMemo unless necessary. This project will run on both iOS and Android but not the web.

Do not use the 'any' type

Add comments for all class methods and significant functions. Describe all parameters and return values. If void do not describe return value.
Review existing method or function comments after implementation changes.

Prefer object destructuring when accessing the store. For example:

```typescript
const { unlockedSkins, unseenUnlockedSkins, selectedSkinId } = useStore();
```

Is preferred over:

```typescript
const unlockedSkins = useStore((s) => s.unlockedSkins);
const unseenUnlockedSkins = useStore((s) => s.unseenUnlockedSkins);
const selectedSkinId = useStore((s) => s.selectedSkinId);
```

Rather than using void with promises prefer to catch with an error logged to sentry

For functions with three or more arguments, prefer to use an object
