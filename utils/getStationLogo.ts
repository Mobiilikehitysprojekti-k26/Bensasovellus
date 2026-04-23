const logos = {
    abc: require('../assets/logos/abc.png'),
    neste: require('../assets/logos/neste.png'),
    st1: require('../assets/logos/st1.png'),
    seo: require('../assets/logos/seo.png'),
    gulf: require('../assets/logos/gulf.png'),
    default: require('../assets/logos/default.png')
} as const

export function getStationLogo(name?: string) {
    if (!name) return logos.default

    const n = name.toLowerCase()

    if (n.includes('abc')) return logos.abc
    if (n.includes('neste')) return logos.neste
    if (n.includes('st1')) return logos.st1
    if (n.includes('seo')) return logos.seo
    if (n.includes('gulf')) return logos.gulf

    return logos.default
}