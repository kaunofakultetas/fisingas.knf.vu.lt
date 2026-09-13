// -----------------------------------------------------------
//  [*] Admin — Sidebar
//
//  Left navigation of the admin pages, Zabbix-style: a narrow
//  icon rail sits in the page layout; moving the mouse over
//  it expands the full panel OVER the page content (the
//  content does not reflow), and leaving collapses it again
//  after a short delay. The pin button at the top docks the
//  sidebar open instead — pinned, it takes its full width in
//  the layout like a classic sidebar. Both states expand to
//  the content-fit width, tracked continuously by a
//  ResizeObserver on an invisible ghost copy of the labels
//  (see useContentWidth); the pinned state is remembered in
//  localStorage ("sidebarOpen").
//
//  The links live in the SECTIONS table — one entry per
//  group, labels hardcoded in Lithuanian (this app has no
//  i18n layer). The row the current route belongs to is
//  highlighted in the brand tint (see findActiveHref).
//
//  Split into (root component last):
//
//    SECTIONS              — the declarative link table
//    clampWidth            — sanity bounds on the width
//    findActiveHref        — which row the current URL is
//    useSidebarPreferences — pinned persistence
//    useHoverExpand        — fly-over hover state
//    useContentWidth       — ghost + ResizeObserver width
//    SectionTitle          — grey group heading
//    MenuItemContent       — icon + label (tooltip on rail)
//    MenuItem              — internal <Link> / external <a>
//    PinButton             — the dock/undock bar
//    SidebarLinks          — SECTIONS rendered as the list
//    AdminSidebar          — slot + panel (default export)
// -----------------------------------------------------------

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';


// Pin/unpin the sidebar
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

// Pagrindinis
import DashboardIcon from "@mui/icons-material/Dashboard";

// Sąrašai
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';

// Prezentacija
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ImageIcon from '@mui/icons-material/Image';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';

// Sistema
import BadgeIcon from '@mui/icons-material/Badge';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ApiIcon from '@mui/icons-material/Api';
import StorageIcon from '@mui/icons-material/Storage';
import ExitToAppIcon from "@mui/icons-material/ExitToApp";


// Sidebar widths (px). The expanded width is content-fit:
// the widest label (reported live by the ResizeObserver in
// useContentWidth) plus LABEL_SURROUND — everything around a
// label in a row: the wrapper's 2×10px padding, the 7.5px
// icon column offset, the 17px icon, the label's 10px margin,
// the row's 10px right padding and the 1px panel border.
// DEFAULT bridges the first frame before the observer fires;
// MIN/MAX are sanity bounds only.
const RAIL_WIDTH = 52;
const DEFAULT_EXPANDED_WIDTH = 210;
const MIN_EXPANDED_WIDTH = 140;
const MAX_EXPANDED_WIDTH = 400;
const LABEL_SURROUND = 20 + 7.5 + 17 + 10 + 10 + 1;

// How long the panel stays expanded after the mouse leaves —
// bridges small gaps so the panel doesn't flicker
const CLOSE_DELAY_MS = 200;







// -----------------------------------------------------------
// SECTIONS
// -----------------------------------------------------------
//
// The whole navigation as data: one entry per section, labels
// are literal Lithuanian strings. Adding a link is a one-line
// edit here — no JSX involved.
//
// Entry fields:
//   - title    — section heading
//   - items[]  — href, icon component, label,
//                `external: true` for links that open in a
//                new tab via a plain <a>, and `activeAlso`
//                — extra path prefixes that light the row up
//                (unused here: the detail pages /admin/
//                students/5 and /admin/questions/5 already
//                nest under their list URLs)
//
// Used by:
//   - SidebarLinks (below) — rendered as the link list
//   - AdminSidebar (below) — the ghost measurer's label copies
// -----------------------------------------------------------

const SECTIONS = [
  {
    title: "PAGRINDINIS",
    items: [
      { href: "/admin", icon: DashboardIcon, label: "Pradžia" },
    ],
  },
  {
    title: "SĄRAŠAI",
    items: [
      { href: "/admin/students", icon: PersonOutlineIcon, label: "Studentai" },
      { href: "/admin/questions", icon: QuestionMarkIcon, label: "Klausimai" },
    ],
  },
  {
    title: "PREZENTACIJA",
    items: [
      { href: "/slides", icon: SlideshowIcon, label: "Skaidrės (Paleisti)", external: true },
      { href: "/filebrowser/slides", icon: ImageIcon, label: "Skaidrės (Failai)", external: true },
      { href: "/leaderboard", icon: LeaderboardIcon, label: "Leaderboard'as", external: true },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { href: "/admin/administrators", icon: BadgeIcon, label: "Administratoriai" },
      { href: "/filebrowser/dropbox", icon: UploadFileIcon, label: "Failų Dropbox'as", external: true },
      { href: "/swagger", icon: ApiIcon, label: "API Dokumentacija", external: true },
      { href: "/dbgate", icon: StorageIcon, label: "Duomenų Bazė", external: true },
      { href: "/login", icon: ExitToAppIcon, label: "Atsijungti" },
    ],
  },
];







// -----------------------------------------------------------
// clampWidth
// -----------------------------------------------------------
//
// Sanity bounds on the expanded width — the value itself is
// always content-driven, this only guards the extremes.
//
// Used by:
//   - useContentWidth (below)
// -----------------------------------------------------------

const clampWidth = (width) =>
  Math.min(Math.max(width, MIN_EXPANDED_WIDTH), MAX_EXPANDED_WIDTH);







// -----------------------------------------------------------
// findActiveHref
// -----------------------------------------------------------
//
// The href of the row the current URL belongs to: an internal
// link is active on its exact path, on everything nested
// under it (/admin/students/5 lights up the students row) and
// on its activeAlso prefixes. The LONGEST matched prefix
// wins, so /admin/students beats /admin and the dashboard row
// only lights up on /admin itself. External rows never match;
// "/" only matches exactly, since every path nests under it.
//
// Used by:
//   - AdminSidebar (below) — recomputed on every navigation
// -----------------------------------------------------------

const findActiveHref = (sections, pathname) => {
  let best = null;
  let bestLength = -1;

  for (const section of sections) {
    for (const item of section.items) {
      if (item.external) continue;
      for (const prefix of [item.href, ...(item.activeAlso ?? [])]) {
        const matches = pathname === prefix || (prefix !== '/' && pathname.startsWith(prefix + '/'));
        if (matches && prefix.length > bestLength) {
          best = item.href;
          bestLength = prefix.length;
        }
      }
    }
  }

  return best;
};







// -----------------------------------------------------------
// useSidebarPreferences
// -----------------------------------------------------------
//
// The persisted pinned (docked open) state. The sidebar
// remounts with the page layout on every navigation, and the
// useState initializer re-reads the stored value each time —
// no extra syncing is needed.
//
// Used by:
//   - AdminSidebar (below)
// -----------------------------------------------------------

function useSidebarPreferences() {

  // Pinned/floating — remembered across page loads; on narrow
  // screens it starts floating so the rail leaves room for
  // the page content (it can still be pinned by hand)
  const [pinned, setPinned] = useState(() =>
    window.innerWidth >= 768 && localStorage.getItem("sidebarOpen") !== "false"
  );

  const togglePinned = () => {
    const newValue = !pinned;
    setPinned(newValue);
    localStorage.setItem('sidebarOpen', newValue);
  };

  return { pinned, togglePinned };
}







// -----------------------------------------------------------
// useHoverExpand
// -----------------------------------------------------------
//
// The fly-over hover state: entering the panel expands it
// immediately, leaving collapses it only after a short delay
// so briefly crossing the panel edge doesn't flicker it shut.
//
// Used by:
//   - AdminSidebar (below)
// -----------------------------------------------------------

function useHoverExpand() {

  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef(null);

  const onMouseEnter = () => {
    clearTimeout(closeTimer.current);
    setHovered(true);
  };

  const onMouseLeave = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return { hovered, onMouseEnter, onMouseLeave };
}







// -----------------------------------------------------------
// useContentWidth
// -----------------------------------------------------------
//
// The content-fit expanded width, tracked continuously: a
// ResizeObserver watches the invisible ghost copy of the
// labels (rendered by the root at natural max-content width)
// and recalibrates whenever its size actually changes — new
// menu items, the late-arriving Inter font (font-display:
// swap re-layouts the labels once the woff2 loads). One-shot
// DOM measurement would go stale on exactly those events; the
// observer fires by itself the moment the ghost is laid out
// again.
//
// Used by:
//   - AdminSidebar (below)
// -----------------------------------------------------------

// The last width any observer reported — module-level, so the
// sidebar (remounted with the page layout on every
// navigation) starts at the already-known width instead of
// the DEFAULT, and doesn't visibly resize for a frame on
// every page switch
let lastMeasuredWidth = DEFAULT_EXPANDED_WIDTH;

function useContentWidth(ghostRef) {

  const [expandedWidth, setExpandedWidth] = useState(() => lastMeasuredWidth);

  useEffect(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;

    const observer = new ResizeObserver((entries) => {
      const labelWidth = entries[0]?.contentRect?.width ?? 0;
      // A ghost that isn't laid out yet reports ~0 — keep the
      // previous value
      if (labelWidth < 30) return;
      lastMeasuredWidth = clampWidth(Math.ceil(labelWidth) + LABEL_SURROUND);
      setExpandedWidth(lastMeasuredWidth);
    });

    observer.observe(ghost);
    return () => observer.disconnect();
  }, [ghostRef]);

  return expandedWidth;
}







// -----------------------------------------------------------
// SectionTitle
// -----------------------------------------------------------
//
// Small grey heading above a group of links. When the sidebar
// is collapsed a real divider line replaces the title so the
// grouping stays visible. The row keeps the same height in
// both states so the links don't jump while the panel
// expands.
//
// Used by:
//   - SidebarLinks (below) — one per section
// -----------------------------------------------------------

const SectionTitle = ({ title, open }) => {
  return (
    <div className="mt-[15px] mb-[2px] h-[15px] flex items-center">
      {open
        ? <p className="text-[10px] font-bold text-[#999] whitespace-pre-wrap m-0">{title}</p>
        : <Divider className="w-full" />
      }
    </div>
  );
};







// -----------------------------------------------------------
// MenuItemContent
// -----------------------------------------------------------
//
// Visual part of a sidebar link: icon + label. On the rail
// only the icon is visible and the label appears as a tooltip
// on hover (tooltip is manually controlled so it never shows
// in the expanded state). The active row — the page currently
// open — sits on a translucent brand tint with its label in
// the brand color.
//
// Used by:
//   - MenuItem (below) — wrapped in a <Link> or <a>
// -----------------------------------------------------------

const MenuItemContent = ({ icon: Icon, label, open, active }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Tooltip
      open={!open && hovered}
      title={label}
      placement="right"
      disableInteractive
      slotProps={{
        tooltip: { sx: { backgroundColor: '#000', fontSize: '15px' } },
      }}
    >
      <li
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setHovered(false)}
        // pl-[7.5px] centers the 17px icon on the 32px rail AND
        // fixes the expanded icon column at the same spot; the
        // fixed h-[23px] (17px icon + 2×3px py) keeps the row
        // the same height with and without the label, so rows
        // never shift down while the sidebar opens/closes
        className={`flex items-center h-[23px] py-[3px] pl-[7.5px] pr-[10px] cursor-pointer whitespace-nowrap rounded-[3px] hover:bg-[#999] transition-colors ${active ? 'bg-[rgba(var(--mui-palette-primary-mainChannel)/0.20)]' : ''}`}
      >
        <Icon style={{ fontSize: '17px', color: 'var(--mui-palette-primary-main)' }} />
        {/* Always in the DOM so the sidebar can measure its
            automatic width and the row height stays constant —
            invisible (not just clipped) on the rail, fading in
            as the panel expands; truncates with … when a label
            outgrows the clamped panel width */}
        <span className={`flex-1 min-w-0 overflow-hidden text-ellipsis text-[13px] leading-[17px] font-semibold ml-[10px] transition-opacity duration-300 ${active ? 'text-primary' : 'text-[rgb(65,65,65)]'} ${open ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
      </li>
    </Tooltip>
  );
};







// -----------------------------------------------------------
// MenuItem
// -----------------------------------------------------------
//
// One sidebar link. Internal links use react-router's <Link>;
// external ones (slides, filebrowser, swagger, dbgate,
// leaderboard) use a plain <a> opening in a new tab.
//
// Used by:
//   - SidebarLinks (below) — every item
// -----------------------------------------------------------

const MenuItem = ({ href, icon: Icon, label, open, active, external = false }) => {
  if (external) {
    return (
      <a href={href} className="no-underline" target="_blank" rel="noopener noreferrer">
        <MenuItemContent icon={Icon} label={label} open={open} active={active} />
      </a>
    );
  }

  return (
    <Link to={href} className="no-underline">
      <MenuItemContent icon={Icon} label={label} open={open} active={active} />
    </Link>
  );
};







// -----------------------------------------------------------
// PinButton
// -----------------------------------------------------------
//
// The dock/undock bar at the top: a full-width burgundy strip
// that follows the sidebar's width, always visible (icon-only
// on the rail). Solid pin = docked, outlined = floating.
//
// Used by:
//   - AdminSidebar (below) — first row of the list
// -----------------------------------------------------------

function PinButton({ pinned, onToggle }) {
  return (
    <Tooltip
      title={pinned ? "Atsegti šoninį meniu" : "Prisegti šoninį meniu"}
      placement="right"
      disableInteractive
      slotProps={{ tooltip: { sx: { backgroundColor: '#000', fontSize: '13px' } } }}
    >
      <button
        onClick={onToggle}
        className="w-full h-[30px] mt-3 flex items-center justify-center bg-primary hover:bg-primary-dark border-0 rounded-md cursor-pointer transition-colors"
      >
        {pinned
          ? <PushPinIcon style={{ fontSize: '18px', color: 'white' }} />
          : <PushPinOutlinedIcon style={{ fontSize: '18px', color: 'rgba(255,255,255,0.85)' }} />
        }
      </button>
    </Tooltip>
  );
}







// -----------------------------------------------------------
// SidebarLinks
// -----------------------------------------------------------
//
// The SECTIONS table rendered as the link list: a heading per
// section and a MenuItem per item, with the active row
// marked.
//
// Used by:
//   - AdminSidebar (below) — inside the measured <ul>
// -----------------------------------------------------------

function SidebarLinks({ open, activeHref }) {
  return (
    <>
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <SectionTitle title={section.title} open={open} />
          {section.items.map((item) => (
            <MenuItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              open={open}
              active={item.href === activeHref}
              external={item.external}
            />
          ))}
        </div>
      ))}
    </>
  );
}







// -----------------------------------------------------------
// AdminSidebar (default export)
// -----------------------------------------------------------
//
// Two nested boxes: the SLOT participates in the page flex
// layout (rail width, or the expanded width when pinned) and
// the PANEL is absolutely positioned inside it, so a hover
// expansion grows the panel over the page content without
// reflowing it. Both pinned and fly-over expand to the
// automatic content-fit width.
//
// Used by:
//   - AdminPageLayout — every admin page
// -----------------------------------------------------------

export default function AdminSidebar() {

  // Which row the open page is — plain derived state,
  // recomputed on every navigation
  const { pathname } = useLocation();
  const activeHref = findActiveHref(SECTIONS, pathname);

  const ghostRef = useRef(null);

  const { hovered, onMouseEnter, onMouseLeave } = useHoverExpand();
  const { pinned, togglePinned } = useSidebarPreferences();
  const expandedWidth = useContentWidth(ghostRef);


  const open = pinned || hovered;
  const overlaying = open && !pinned;

  return (
    // The slot — holds layout space: just the rail, or the
    // full width when the sidebar is pinned
    <div
      className="relative shrink-0 transition-[width] duration-300 ease-in-out"
      style={{ width: pinned ? expandedWidth : RAIL_WIDTH }}
    >
      {/* The panel — flies over the content when hover-expanded */}
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`absolute inset-y-0 left-0 z-40 border-r border-edge bg-white overflow-y-auto overflow-x-hidden transition-[width,box-shadow] duration-300 ease-in-out ${overlaying ? 'shadow-[4px_0_20px_rgba(0,0,0,0.25)]' : ''}`}
        style={{ width: open ? expandedWidth : RAIL_WIDTH }}
      >
        {/* Ghost measurer — an invisible, zero-height copy of
            every label at natural width, watched by the
            ResizeObserver in useContentWidth. Same typography
            classes as the real labels so it measures true. */}
        <div ref={ghostRef} aria-hidden="true" className="absolute invisible h-0 overflow-hidden w-max whitespace-nowrap text-[13px] font-semibold">
          {SECTIONS.flatMap((section) => section.items).map((item) => (
            <div key={item.href}>{item.label}</div>
          ))}
        </div>

        <div className="px-[10px]">
          <ul className="list-none m-0 p-0">
            <PinButton pinned={pinned} onToggle={togglePinned} />
            <SidebarLinks open={open} activeHref={activeHref} />
          </ul>
        </div>
      </div>
    </div>
  );
}
