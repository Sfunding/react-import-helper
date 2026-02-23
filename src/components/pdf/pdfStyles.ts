import { StyleSheet } from '@react-pdf/renderer';

// Color palette
export const COLORS = {
  NAVY: '#0B1D3A',
  DARK_BLUE: '#122B52',
  MID_BLUE: '#1B3A6B',
  ACCENT: '#00C9A7',
  ACCENT_DK: '#00A88A',
  GOLD: '#F0B94D',
  RED: '#E8555A',
  GREEN: '#2ECC71',
  LIGHT_GRAY: '#F4F6F8',
  MED_GRAY: '#B0BEC5',
  DARK_GRAY: '#546E7A',
  TEXT_DARK: '#1A2332',
  TEXT_MED: '#4A5568',
  WHITE: '#FFFFFF',
  LIGHT_RED_BG: '#FFF5F5',
  LIGHT_GREEN_BG: '#E8FFF5',
  LIGHT_YELLOW_BG: '#FFF8E1',
  LIGHT_BLUE_BG: '#EBF4FF',
  RED_BORDER: '#FDE8E8',
  GREEN_BORDER: '#D5F5ED',
  MUTED_BLUE: '#8899BB',
};

export const PAGE = {
  WIDTH: 612,
  HEIGHT: 792,
  MARGIN: 43,
};

export const CONTENT_WIDTH = PAGE.WIDTH - PAGE.MARGIN * 2; // 526

export const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.TEXT_DARK,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 15,
    left: PAGE.MARGIN,
    right: PAGE.MARGIN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: COLORS.ACCENT,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.MED_GRAY,
  },

  // Header bar (pages 2-4)
  headerBar: {
    height: 52,
    backgroundColor: COLORS.NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE.MARGIN,
  },
  headerBarTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.WHITE,
  },
  headerBarSubtitle: {
    fontSize: 9,
    color: COLORS.ACCENT,
    fontFamily: 'Helvetica-Bold',
  },

  // Content container
  content: {
    paddingHorizontal: PAGE.MARGIN,
  },

  // Section header
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.TEXT_DARK,
    marginBottom: 6,
    marginTop: 12,
  },

  // Table styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.NAVY,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.WHITE,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    minHeight: 22,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: COLORS.LIGHT_GRAY,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.TEXT_DARK,
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.TEXT_DARK,
  },

  // Total row
  tableTotalRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.DARK_BLUE,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  tableTotalCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.WHITE,
  },
  tableTotalCellAccent: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.ACCENT,
  },

  // Stat card
  statCard: {
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: COLORS.MED_GRAY,
    backgroundColor: COLORS.WHITE,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardAccentTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  statCardValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },
  statCardLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    color: COLORS.DARK_GRAY,
    marginTop: 3,
  },

  // Banner
  banner: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});
