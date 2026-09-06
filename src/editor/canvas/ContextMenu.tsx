import { useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useStrings } from '../../i18n/LanguageContext';
import type { Point } from '../../model/types';
import type { MenuItem as MenuItemModel } from './menuItems';

export interface ContextMenuProps {
  open: boolean;
  /** Where the menu opens, in client (screen) coordinates. */
  position: Point | null;
  items: MenuItemModel[];
  /** A leaf was picked. The menu closes itself right after. */
  onSelect(item: MenuItemModel): void;
  onClose(): void;
  /** Resolve a `MenuItem.icon` key to a mark (the Icon submenu's logos). */
  renderIcon?(icon: string): ReactNode;
  /** Accessible name of the root menu. */
  ariaLabel?: string;
}

/**
 * THE context menu — one component for every right-click in the editor.
 *
 * Renders a `MenuItem[]` from `menuItems.ts` as a MUI `Menu` anchored at a
 * screen point: nested submenus open on hover, click or → and close on ←, Esc or
 * hovering a sibling; shortcut hints sit right-aligned in a muted mono face;
 * `danger` items take the error colour; a disabled item keeps its pointer events
 * so its `disabledReason` can show as a tooltip. Everything about WHAT is in the
 * menu is decided elsewhere — this file only knows how to draw an item.
 */
export function ContextMenu({
  open,
  position,
  items,
  onSelect,
  onClose,
  renderIcon,
  ariaLabel,
}: ContextMenuProps) {
  const { t } = useStrings();
  const rendered = useLevelItems({
    items,
    open,
    renderIcon,
    onSelect: (item) => {
      onSelect(item);
      onClose();
    },
  });
  return (
    <Menu
      open={open && position !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position ? { top: position.y, left: position.x } : undefined}
      MenuListProps={{ dense: true, 'aria-label': ariaLabel ?? t('menu.contextLabel') }}
      slotProps={{ paper: { sx: { minWidth: 220, maxWidth: 340 } } }}
    >
      {rendered}
    </Menu>
  );
}

// --- one level ------------------------------------------------------------------

interface LevelArgs {
  items: MenuItemModel[];
  /** Whether this level is showing; a level that closes forgets its open submenu. */
  open: boolean;
  onSelect(item: MenuItemModel): void;
  renderIcon?(icon: string): ReactNode;
}

/**
 * The items of one menu level as direct `Menu` children. A hook rather than a
 * wrapper component on purpose: MUI's `MenuList` reads its children to pick the
 * item that receives focus, so the `MenuItem`s must be its immediate children.
 */
function useLevelItems({ items, open, onSelect, renderIcon }: LevelArgs): ReactNode[] {
  // Which submenu is open at this level, and whether the keyboard opened it —
  // a keyboard-opened submenu takes focus, a hover-opened one leaves it where it is.
  const [openId, setOpenId] = useState<string | null>(null);
  const [byKeyboard, setByKeyboard] = useState(false);
  useEffect(() => {
    if (!open) setOpenId(null);
  }, [open]);

  // Reserve the leading column when any sibling has a check mark or an icon, so
  // labels in one list line up whatever the item to the left of them shows.
  const reserveColumn = items.some((i) => i.checked !== undefined || i.icon !== undefined);
  const closeSub = () => setOpenId(null);

  return items.map((item) => {
    if (item.divider) return <Divider key={item.id} component="li" sx={{ my: 0.5 }} />;
    if (item.children) {
      return (
        <SubMenuItem
          key={item.id}
          item={item}
          open={openId === item.id}
          byKeyboard={byKeyboard}
          reserveColumn={reserveColumn}
          renderIcon={renderIcon}
          onSelect={onSelect}
          onOpen={(keyboard) => {
            setOpenId(item.id);
            setByKeyboard(keyboard);
          }}
          onCloseSub={closeSub}
        />
      );
    }
    return (
      <LeafItem
        key={item.id}
        item={item}
        reserveColumn={reserveColumn}
        renderIcon={renderIcon}
        onSelect={onSelect}
        onEnter={closeSub}
      />
    );
  });
}

// --- item chrome ----------------------------------------------------------------

function CheckGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Label, optional leading mark and right-aligned shortcut — the body of every item. */
function ItemContent({
  item,
  reserveColumn,
  renderIcon,
  trailing,
}: {
  item: MenuItemModel;
  reserveColumn: boolean;
  renderIcon?(icon: string): ReactNode;
  trailing?: ReactNode;
}) {
  const { t } = useStrings();
  return (
    <>
      {reserveColumn && (
        <ListItemIcon sx={{ minWidth: '28px !important', color: 'inherit' }}>
          {item.checked ? <CheckGlyph /> : item.icon && renderIcon ? renderIcon(item.icon) : null}
        </ListItemIcon>
      )}
      <ListItemText
        primary={item.label}
        primaryTypographyProps={{ fontSize: 13, noWrap: true }}
        sx={{ my: 0 }}
      />
      {item.shortcut && (
        <Typography
          component="kbd"
          aria-label={t('menu.shortcutAria', { keys: item.shortcut })}
          sx={{
            ml: 3,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 11,
            color: 'text.disabled',
            whiteSpace: 'nowrap',
          }}
        >
          {item.shortcut}
        </Typography>
      )}
      {trailing}
    </>
  );
}

/**
 * A disabled item explains itself: MUI turns pointer events off on `Mui-disabled`,
 * which would also switch the tooltip off, so they are turned back on and the
 * click handler is simply not attached.
 */
const disabledWithTooltipSx = { '&.Mui-disabled': { pointerEvents: 'auto' } } as const;

function itemSx(item: MenuItemModel) {
  return {
    py: 0.5,
    ...(item.danger ? { color: 'error.main' } : {}),
    ...(item.disabled && item.disabledReason ? disabledWithTooltipSx : {}),
  };
}

function withReason(item: MenuItemModel, content: ReactNode): ReactNode {
  if (!item.disabled || !item.disabledReason) return content;
  return (
    // `describeChild`: the reason goes into aria-describedby, so the item keeps
    // its label as its accessible name instead of the tooltip text.
    <Tooltip title={item.disabledReason} placement="right" enterDelay={150} describeChild>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>{content}</Box>
    </Tooltip>
  );
}

function LeafItem({
  item,
  reserveColumn,
  renderIcon,
  onSelect,
  onEnter,
  autoFocus,
  tabIndex,
}: {
  item: MenuItemModel;
  reserveColumn: boolean;
  renderIcon?(icon: string): ReactNode;
  onSelect(item: MenuItemModel): void;
  /** Pointer or focus arrived here: any open sibling submenu closes. */
  onEnter(): void;
  // Cloned onto the active child by MUI's MenuList; forwarded to the item.
  autoFocus?: boolean;
  tabIndex?: number;
}) {
  const checkable = item.checked !== undefined;
  return (
    <MenuItem
      disabled={item.disabled}
      autoFocus={autoFocus}
      tabIndex={tabIndex}
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? item.checked : undefined}
      className={item.danger ? 'lv-menu-danger' : undefined}
      onMouseEnter={onEnter}
      onFocus={onEnter}
      onClick={item.disabled ? undefined : () => onSelect(item)}
      sx={itemSx(item)}
    >
      {withReason(item, <ItemContent item={item} reserveColumn={reserveColumn} renderIcon={renderIcon} />)}
    </MenuItem>
  );
}

function SubMenuItem({
  item,
  open,
  byKeyboard,
  reserveColumn,
  renderIcon,
  onSelect,
  onOpen,
  onCloseSub,
  autoFocus,
  tabIndex,
}: {
  item: MenuItemModel;
  open: boolean;
  byKeyboard: boolean;
  reserveColumn: boolean;
  renderIcon?(icon: string): ReactNode;
  onSelect(item: MenuItemModel): void;
  onOpen(byKeyboard: boolean): void;
  onCloseSub(): void;
  autoFocus?: boolean;
  tabIndex?: number;
}) {
  const anchorRef = useRef<HTMLLIElement>(null);
  const disabled = Boolean(item.disabled);
  const isOpen = open && !disabled;
  const children = useLevelItems({ items: item.children ?? [], open: isOpen, onSelect, renderIcon });

  return (
    <>
      <MenuItem
        ref={anchorRef}
        disabled={disabled}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={item.danger ? 'lv-menu-danger' : undefined}
        onMouseEnter={disabled ? undefined : () => onOpen(false)}
        // `detail` is 0 for a click synthesised from Enter/Space, so the keyboard
        // path takes focus into the submenu and the pointer path leaves it be.
        onClick={disabled ? undefined : (event) => onOpen(event.detail === 0)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowRight' || disabled) return;
          event.preventDefault();
          event.stopPropagation();
          onOpen(true);
        }}
        sx={itemSx(item)}
      >
        {withReason(
          item,
          <ItemContent
            item={item}
            reserveColumn={reserveColumn}
            renderIcon={renderIcon}
            trailing={
              <Box component="span" sx={{ display: 'flex', ml: 1.5, color: 'text.secondary' }}>
                <ChevronGlyph />
              </Box>
            }
          />,
        )}
      </MenuItem>
      {/* A Popper, not a second `Menu`: a nested Menu is a nested Modal, which
          aria-hides everything else on the page — the parent menu included — and
          traps focus. This one renders inside the item (`disablePortal`) so the
          parent's focus trap already contains it, and positions itself `fixed`
          so the parent Paper's overflow cannot clip it. Keyboard events stop at
          its edge; the parent list would otherwise walk the same arrow keys. */}
      <Popper
        open={isOpen}
        anchorEl={anchorRef.current}
        placement="right-start"
        disablePortal
        popperOptions={{ strategy: 'fixed' }}
        modifiers={[{ name: 'offset', options: { offset: [-6, -4] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <Paper elevation={8} sx={{ minWidth: 180, maxWidth: 320 }}>
          <MenuList
            dense
            aria-label={item.label}
            autoFocusItem={byKeyboard}
            onKeyDown={(event) => {
              if (event.key === 'Tab') return; // the root menu closes on Tab
              event.stopPropagation();
              if (event.key === 'ArrowLeft' || event.key === 'Escape') {
                event.preventDefault();
                onCloseSub();
                anchorRef.current?.focus();
              }
            }}
          >
            {children}
          </MenuList>
        </Paper>
      </Popper>
    </>
  );
}
