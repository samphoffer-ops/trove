import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { Colors, Radius } from '@/lib/theme';
import { Logo } from './Logo';

const NAV_LINKS = [
  { href: '/' as const,          label: 'home' },
  { href: '/features' as const,  label: 'features' },
  { href: '/about' as const,     label: 'about' },
  { href: '/for-brands' as const,label: 'for brands' },
];

const MAX_WIDTH = 1080;

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const narrow = width < 720;

  return (
    <View style={styles.root}>
      <View style={styles.navBar}>
        <View style={[styles.navInner, { maxWidth: MAX_WIDTH }]}>
          <Link href="/" asChild>
            <Pressable><Logo width={104} /></Pressable>
          </Link>

          {!narrow && (
            <View style={styles.navLinks}>
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} style={[styles.navLink, pathname === link.href && styles.navLinkActive]}>
                  {link.label}
                </Link>
              ))}
            </View>
          )}

          <View style={styles.navActions}>
            <Link href="/(auth)/sign-in" style={styles.loginLink}>log in</Link>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable style={styles.signUpBtn}>
                <Text style={styles.signUpBtnText}>Start discovering</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {narrow && (
          <View style={[styles.navLinksNarrow, { maxWidth: MAX_WIDTH }]}>
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={[styles.navLink, pathname === link.href && styles.navLinkActive]}>
                {link.label}
              </Link>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, { maxWidth: MAX_WIDTH }]}>
          {children}
        </View>

        <View style={styles.footer}>
          <View style={[styles.footerInner, { maxWidth: MAX_WIDTH }]}>
            <Logo width={90} />
            <View style={styles.footerLinks}>
              <Link href="/privacy-policy" style={styles.footerLink}>privacy policy</Link>
              <Link href="/terms" style={styles.footerLink}>terms of service</Link>
              <Link href="/contact" style={styles.footerLink}>contact</Link>
            </View>
            <Text style={styles.footerCopy}>© {new Date().getFullYear()} trove. all rights reserved.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  navBar:   {
    backgroundColor: 'rgba(255,248,240,0.92)',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    position: 'sticky' as any, top: 0, zIndex: 50,
  },
  navInner: {
    width: '100%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  navLinks: { flexDirection: 'row', gap: 28 },
  navLinksNarrow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 14 },
  navLink: { fontSize: 14.5, fontWeight: '600', color: Colors.textMuted, textDecorationLine: 'none' } as any,
  navLinkActive: { color: Colors.text },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  loginLink: { fontSize: 14.5, fontWeight: '600', color: Colors.text, textDecorationLine: 'none' } as any,
  signUpBtn: { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 },
  signUpBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content:  { width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  footer:   { width: '100%', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 80 },
  footerInner: {
    width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 36,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
  },
  footerLinks: { flexDirection: 'row', gap: 20 },
  footerLink: { fontSize: 13.5, fontWeight: '600', color: Colors.textMuted, textDecorationLine: 'none' } as any,
  footerCopy: { fontSize: 12.5, color: Colors.textMuted },
});
