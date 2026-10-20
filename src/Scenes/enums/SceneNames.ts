export enum SceneName {
    Test = 'test',
    Home = 'home',
    Hardware = 'hardware',
    Hannaford = 'hannaford',
    Auto = 'auto',
    Library = 'library',
    Woods = 'woods',
    Desert = 'desert',
    Jungle = 'jungle',
    City = 'city',

    // City building interiors (reached from CityScene). The museum has a chain of
    // basement levels going deeper (B1 shallowest -> B4 deepest).
    CityPowerTower = 'city-power-tower',
    CityFinance = 'city-finance',
    CityLargeTower = 'city-large-tower',
    CityChurch = 'city-church',
    CityFashion = 'city-fashion',
    CityRadioTower = 'city-radio-tower',
    CityPowerStation = 'city-power-station',
    CityRadioTower2 = 'city-radio-tower-2',
    CityMuseum = 'city-museum',
    CityMuseumB1 = 'city-museum-b1',
    CityMuseumB2 = 'city-museum-b2',
    CityMuseumB3 = 'city-museum-b3',
    CityMuseumB4 = 'city-museum-b4',

    // The hidden Atlantis sanctum. Reached ONLY via the key-gated "custom" (purple)
    // tunnel in the museum's lowest level (B4) — no public entrance.
    Atlantis = 'atlantis'
}
