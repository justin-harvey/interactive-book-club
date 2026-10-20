export enum LayerType {
    Floor = 'floor',
    Walls = 'walls',
    Furnitures = 'furnitures',
    Details = 'details',
    // Rendered ABOVE characters (tree canopies, roofs) so the player walks under
    // them. WoodsScene raises this layer's depth past the character depth.
    Overhead = 'overhead'
}